import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { bottles } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";

/**
 * Owns Bottle image storage and attachment. User ownership is checked here;
 * the separate worker capability is intentionally limited to existing Bottles.
 */

export class BottleImageBottleNotFoundError extends Error {
  constructor(readonly bottleId: number) {
    super("Bottle not found.");
    this.name = "BottleImageBottleNotFoundError";
  }
}

export class BottleImageForbiddenError extends Error {
  constructor() {
    super("You don't have permission to update this bottle.");
    this.name = "BottleImageForbiddenError";
  }
}

export class BottleImageTooLargeError extends Error {
  constructor(readonly cause: unknown) {
    super(
      `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
    );
    this.name = "BottleImageTooLargeError";
  }
}

async function persistBottleImage(bottleId: number, file: Blob) {
  let imageUrl: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileStream = Readable.from(Buffer.from(arrayBuffer));
    imageUrl = await storeFile({
      data: { file: fileStream },
      namespace: "bottles",
      urlPrefix: "/uploads",
      onProcess: (...args) => compressAndResizeImage(...args, undefined, 1024),
    });
  } catch (error) {
    if (file.size > MAX_FILESIZE) {
      throw new BottleImageTooLargeError(error);
    }
    throw error;
  }

  await db.update(bottles).set({ imageUrl }).where(eq(bottles.id, bottleId));
  return { imageUrl: absoluteUrl(config.API_SERVER, imageUrl) };
}

export async function updateBottleImageForUser({
  bottleId,
  file,
  user,
}: {
  bottleId: number;
  file: Blob;
  user: User;
}) {
  const targetBottle = await db.query.bottles.findFirst({
    where: eq(bottles.id, bottleId),
  });
  if (!targetBottle) throw new BottleImageBottleNotFoundError(bottleId);

  const userActor = await getUserActor(user);
  if (
    !user.admin &&
    !user.mod &&
    targetBottle.createdByActorId !== userActor.id
  ) {
    throw new BottleImageForbiddenError();
  }

  return persistBottleImage(targetBottle.id, file);
}

/** Trusted scraper capability; only an existing Bottle may be updated. */
export async function updateBottleImageAsPeated({
  bottleId,
  file,
}: {
  bottleId: number;
  file: Blob;
}) {
  const targetBottle = await db.query.bottles.findFirst({
    where: eq(bottles.id, bottleId),
    columns: { id: true },
  });
  if (!targetBottle) throw new BottleImageBottleNotFoundError(bottleId);
  return persistBottleImage(targetBottle.id, file);
}
