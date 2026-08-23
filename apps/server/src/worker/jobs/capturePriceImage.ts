import { defaultHeaders } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import { logInfo, logTelemetryError } from "@peated/server/lib/log";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { pushUniqueJob } from "@peated/server/worker/client";
import type { JobContext } from "@peated/server/worker/types";
import { eq } from "drizzle-orm";
import { Readable } from "stream";

export interface CapturePriceImageServices {
  compressImage: typeof compressAndResizeImage;
  fetchImage: typeof fetch;
  queueResolution: typeof pushUniqueJob;
  storeImage: typeof storeFile;
}

const capturePriceImageServices: CapturePriceImageServices = {
  compressImage: compressAndResizeImage,
  fetchImage: fetch,
  queueResolution: pushUniqueJob,
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
  const req = await services.fetchImage(imageUrl, {
    headers: defaultHeaders(imageUrl),
  });
  if (!req.body) return null;
  const file = Readable.from(readResponseBody(req.body));

  if (!file) return null;
  const fileData = {
    file,
    filename,
  };

  return await services.storeImage({
    data: fileData,
    namespace: `prices`,
    urlPrefix: "/uploads",
    onProcess: (...args) => services.compressImage(...args, undefined, 1024),
  });
}

async function* readResponseBody(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) return;
      yield result.value;
    }
  } finally {
    reader.releaseLock();
  }
}

export default async (
  {
    priceId,
    imageUrl,
  }: {
    priceId: number;
    imageUrl: string;
  },
  _context?: JobContext,
  services: CapturePriceImageServices = capturePriceImageServices,
) => {
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
