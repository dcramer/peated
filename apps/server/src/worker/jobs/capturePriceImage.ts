import { defaultHeaders } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottles, storePrices } from "@peated/server/db/schema";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import * as Sentry from "@sentry/node";
import { eq } from "drizzle-orm";
import { Readable } from "stream";

const { info, fmt } = Sentry._experiment_log; // Temporary destructuring while this is experimental

async function fetchAndStoreImage(imageUrl: string): Promise<string | null> {
  const filename = imageUrl.split("/").pop() || "image";

  info(fmt`Fetching image [${imageUrl}]`);
  const req = await fetch(imageUrl, { headers: defaultHeaders(imageUrl) });
  if (!req.body) return null;
  const file = Readable.fromWeb(req.body as any);

  if (!file) return null;
  const fileData = {
    file,
    filename,
  };

  return await storeFile({
    data: fileData,
    namespace: `prices`,
    urlPrefix: "/uploads",
    onProcess: (...args) => compressAndResizeImage(...args, undefined, 1024),
  });
}

export default async ({
  priceId,
  imageUrl,
}: {
  priceId: number;
  imageUrl: string;
}) => {
  const price = await db.query.storePrices.findFirst({
    where: (storePrices, { eq }) => eq(storePrices.id, priceId),
  });
  if (!price) {
    throw new Error(`Unknown price: ${priceId}`);
  }

  const newImageUrl = await fetchAndStoreImage(imageUrl);
  if (!newImageUrl) {
    console.error(`Failed to fetch image at ${imageUrl}`);
    return;
  }

  // TODO: we likely want to validate the image is something we'd expect
  await db
    .update(storePrices)
    .set({
      imageUrl: newImageUrl,
    })
    .where(eq(storePrices.id, priceId));

  if (price.bottleId) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, price.bottleId));

    if (bottle && !bottle.imageUrl) {
      await db
        .update(bottles)
        .set({
          imageUrl: newImageUrl,
        })
        .where(eq(bottles.id, price.bottleId));
    }
  }
};
