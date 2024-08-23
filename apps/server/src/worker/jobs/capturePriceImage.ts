import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { eq } from "drizzle-orm";
import { get } from "http";
import { Readable } from "stream";

async function fetchAndStoreImage(imageUrl: string): Promise<string | null> {
  const filename = imageUrl.split("/").pop() || "image";

  console.log(`Fetching image [${imageUrl}]`);
  const req = await fetch(imageUrl);
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
};
