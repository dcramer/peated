import type { FileRead } from "@peated/bot";
import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import { logInfo, logTelemetryError } from "@peated/server/lib/log";
import { createServerPeatedBot } from "@peated/server/lib/peatedBot";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { pushJob } from "@peated/server/worker/dispatch";
import type { JobContext, JobPayload } from "@peated/server/worker/types";
import { eq } from "drizzle-orm";
import { Readable } from "stream";
import { z } from "zod";

export const CapturePriceImageJobArgsSchema = z
  .object({
    priceId: z.number().int().positive(),
    imageUrl: z.string(),
  })
  .strict();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface CapturePriceImageServices {
  compressImage: typeof compressAndResizeImage;
  readImage: (url: string) => Promise<FileRead>;
  queueResolution: typeof pushJob;
  storeImage: typeof storeFile;
}

const capturePriceImageServices: CapturePriceImageServices = {
  compressImage: compressAndResizeImage,
  // Images are read directly as PeatedBot, never through Firecrawl. A
  // retailer that never answers must not hold the queue: the job runs at
  // concurrency 1 and BullMQ renews its lock for as long as it waits.
  readImage: async (url) =>
    await createServerPeatedBot({ firecrawlApiKey: null }).readFile({
      url,
      accept: "image/*,*/*;q=0.1",
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 30_000,
    }),
  queueResolution: pushJob,
  storeImage: storeFile,
};

async function fetchAndStoreImage(
  imageUrl: string,
  services: CapturePriceImageServices,
): Promise<string | null> {
  const filename = imageUrl.split("/").pop() || "image";

  logInfo("Fetching image {imageUrl}", {
    extra: {
      imageUrl,
    },
  });
  const image = await services.readImage(imageUrl);
  if (image.status !== "ok") {
    logInfo("Could not read image {imageUrl}: {reason}", {
      extra: { imageUrl, reason: image.reason },
    });
    return null;
  }
  const fileData = {
    file: Readable.from([Buffer.from(image.body)]),
    filename,
  };

  return await services.storeImage({
    data: fileData,
    namespace: `prices`,
    urlPrefix: "/uploads",
    onProcess: (...args) => services.compressImage(...args, undefined, 1024),
  });
}

export default async (
  input: JobPayload,
  _context?: JobContext,
  services: CapturePriceImageServices = capturePriceImageServices,
) => {
  const { priceId, imageUrl } = CapturePriceImageJobArgsSchema.parse(input);

  const price = await db.query.storePrices.findFirst({
    where: (storePrices, { eq }) => eq(storePrices.id, priceId),
  });
  if (!price) {
    throw new Error(`Unknown price: ${priceId}`);
  }

  const newImageUrl = await fetchAndStoreImage(imageUrl, services);
  if (!newImageUrl) {
    logTelemetryError("Failed to fetch price image", {
      extra: {
        imageUrl,
        priceId,
      },
    });
    return;
  }

  await db
    .update(storePrices)
    .set({
      imageUrl: newImageUrl,
    })
    .where(eq(storePrices.id, priceId));

  await services.queueResolution("ResolveStorePriceBottle", {
    priceId,
  });
};
