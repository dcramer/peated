import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { bottleImages, bottles } from "@peated/server/db/schema";
import { getPeatedSystemActor, getUserActor } from "@peated/server/lib/actors";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { and, eq } from "drizzle-orm";
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

export class BottleImageNotFoundError extends Error {
  constructor(readonly bottleId: number) {
    super("Bottle image not found.");
    this.name = "BottleImageNotFoundError";
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

async function persistBottleImage({
  bottleId,
  file,
  currentImageUrl,
  actorId,
  sourceUrl,
  license,
}: {
  bottleId: number;
  file?: Blob;
  currentImageUrl: string | null;
  actorId: number;
  sourceUrl?: string | null;
  license?: string | null;
}) {
  let imageUrl = currentImageUrl;
  if (file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileStream = Readable.from(Buffer.from(arrayBuffer));
      imageUrl = await storeFile({
        data: { file: fileStream },
        namespace: "bottles",
        urlPrefix: "/uploads",
        onProcess: (...args) =>
          compressAndResizeImage(...args, undefined, 1024),
      });
    } catch (error) {
      if (file.size > MAX_FILESIZE) {
        throw new BottleImageTooLargeError(error);
      }
      throw error;
    }
  }
  if (!imageUrl) throw new BottleImageNotFoundError(bottleId);

  const storedImage = await db.transaction(async (tx) => {
    if (file) {
      await tx
        .update(bottleImages)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(bottleImages.bottleId, bottleId),
            eq(bottleImages.isPrimary, true),
          ),
        );
      const [image] = await tx
        .insert(bottleImages)
        .values({
          bottleId,
          imageUrl,
          sourceUrl: sourceUrl ?? null,
          license: license ?? null,
          isPrimary: true,
          createdByActorId: actorId,
        })
        .returning({
          sourceUrl: bottleImages.sourceUrl,
          license: bottleImages.license,
        });
      await tx
        .update(bottles)
        .set({ imageUrl })
        .where(eq(bottles.id, bottleId));
      return image;
    }

    const imageChanges: Partial<typeof bottleImages.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (sourceUrl !== undefined) imageChanges.sourceUrl = sourceUrl;
    if (license !== undefined) imageChanges.license = license;
    const [updatedImage] = await tx
      .update(bottleImages)
      .set(imageChanges)
      .where(
        and(
          eq(bottleImages.bottleId, bottleId),
          eq(bottleImages.isPrimary, true),
        ),
      )
      .returning({
        sourceUrl: bottleImages.sourceUrl,
        license: bottleImages.license,
      });
    if (updatedImage) return updatedImage;
    const [image] = await tx
      .insert(bottleImages)
      .values({
        bottleId,
        imageUrl,
        sourceUrl: sourceUrl ?? null,
        license: license ?? null,
        isPrimary: true,
        createdByActorId: actorId,
      })
      .returning({
        sourceUrl: bottleImages.sourceUrl,
        license: bottleImages.license,
      });
    return image;
  });
  if (!storedImage) {
    throw new Error("Bottle image was not saved.");
  }
  return {
    imageUrl: absoluteUrl(config.API_SERVER, imageUrl),
    sourceUrl: storedImage.sourceUrl,
    license: storedImage.license,
  };
}

export async function updateBottleImageForUser({
  bottleId,
  file,
  sourceUrl,
  license,
  user,
}: {
  bottleId: number;
  file?: Blob;
  sourceUrl?: string | null;
  license?: string | null;
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

  return persistBottleImage({
    bottleId: targetBottle.id,
    file,
    currentImageUrl: targetBottle.imageUrl,
    actorId: userActor.id,
    sourceUrl,
    license,
  });
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
    columns: { id: true, imageUrl: true },
  });
  if (!targetBottle) throw new BottleImageBottleNotFoundError(bottleId);
  const actor = await getPeatedSystemActor();
  return persistBottleImage({
    bottleId: targetBottle.id,
    file,
    currentImageUrl: targetBottle.imageUrl,
    actorId: actor.id,
  });
}
