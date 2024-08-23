import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { eq } from "drizzle-orm";
import type { IncomingMessage } from "http";
import { get } from "http";

function asyncGet(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      resolve(res);
    }).on("error", (err) => {
      reject(err);
    });
  });
}

async function fetchAndStoreImage(imageUrl: string): Promise<string | null> {
  const filename = imageUrl.split("/").pop() || "image";

  console.log(`Fetching image [${imageUrl}]`);
  const file = await asyncGet(imageUrl);

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

  // TODO: we likely want to validate the image is something we'd expect
  await db
    .update(storePrices)
    .set({
      imageUrl: await fetchAndStoreImage(imageUrl),
    })
    .where(eq(storePrices.id, priceId));
};
