/**
 * Owns Entity image files and the one-primary-image rule.
 * API routes own moderator authorization.
 * Database rows are authoritative; file cleanup after deletion is best effort.
 */
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  changes,
  entities,
  entityImages,
  type EntityImage,
  type User,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { logError } from "@peated/server/lib/log";
import { humanizeBytes } from "@peated/server/lib/strings";
import {
  compressAndResizeImage,
  deleteFile,
  storeFile,
} from "@peated/server/lib/uploads";
import { and, asc, eq, ne } from "drizzle-orm";
import { Readable } from "node:stream";

export class EntityImageNotFoundError extends Error {
  constructor(readonly resource: "Entity" | "Image") {
    super(`${resource} not found.`);
    this.name = "EntityImageNotFoundError";
  }
}

export class EntityImageTooLargeError extends Error {
  constructor(readonly cause?: unknown) {
    super(
      `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
    );
    this.name = "EntityImageTooLargeError";
  }
}

function ownedEntityImageFilename(imageUrl: string): string | null {
  const pathname = new URL(imageUrl, "https://peated.invalid").pathname;
  const prefix = "/uploads/entities/";
  if (!pathname.startsWith(prefix)) return null;
  const filename = decodeURIComponent(pathname.slice("/uploads/".length));
  if (!filename || filename.includes("\\") || filename.includes("..")) {
    return null;
  }
  return filename;
}

/** Removes a server-owned Entity image without changing database state. */
export async function deleteOwnedEntityImage(imageUrl: string) {
  const filename = ownedEntityImageFilename(imageUrl);
  if (!filename) return;
  try {
    await deleteFile({ filename });
  } catch (error) {
    logError(error, {
      entityImage: { imageUrl, source: "entity_image_cleanup" },
    });
  }
}

/** Adds one image and makes the first image primary. */
export async function createEntityImage({
  entityId,
  file,
  caption,
  sourceUrl,
  license,
  isPrimary,
  idempotencyKey,
  user,
}: {
  entityId: number;
  file: Blob;
  caption: string | null;
  sourceUrl: string | null;
  license: string | null;
  isPrimary: boolean;
  idempotencyKey: string;
  user: User;
}): Promise<EntityImage> {
  if (file.size > MAX_FILESIZE) throw new EntityImageTooLargeError();

  const entity = await db.query.entities.findFirst({
    where: eq(entities.id, entityId),
    columns: { id: true },
  });
  if (!entity) throw new EntityImageNotFoundError("Entity");
  const actor = await getUserActorForDatabase(db, user);

  const existingImage = await db.query.entityImages.findFirst({
    where: and(
      eq(entityImages.entityId, entityId),
      eq(entityImages.createdByActorId, actor.id),
      eq(entityImages.idempotencyKey, idempotencyKey),
    ),
  });
  if (existingImage) return existingImage;

  let imageUrl: string;
  try {
    imageUrl = await storeFile({
      data: { file: Readable.from(Buffer.from(await file.arrayBuffer())) },
      namespace: "entity-image",
      directory: "entities",
      urlPrefix: "/uploads",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
  } catch (error) {
    if (file.size > MAX_FILESIZE) throw new EntityImageTooLargeError(error);
    throw error;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [lockedEntity] = await tx
        .select({
          id: entities.id,
          name: entities.name,
        })
        .from(entities)
        .where(eq(entities.id, entityId))
        .for("update");
      if (!lockedEntity) throw new EntityImageNotFoundError("Entity");

      const [existingImage] = await tx
        .select()
        .from(entityImages)
        .where(
          and(
            eq(entityImages.entityId, entityId),
            eq(entityImages.createdByActorId, actor.id),
            eq(entityImages.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (existingImage) return { image: existingImage, created: false };

      const [currentImage] = await tx
        .select({ id: entityImages.id })
        .from(entityImages)
        .where(eq(entityImages.entityId, entityId))
        .limit(1);
      const makePrimary = isPrimary || !currentImage;
      if (makePrimary) {
        await tx
          .update(entityImages)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(entityImages.entityId, entityId));
      }

      const [image] = await tx
        .insert(entityImages)
        .values({
          entityId,
          imageUrl,
          caption,
          sourceUrl,
          license,
          isPrimary: makePrimary,
          createdByActorId: actor.id,
          idempotencyKey,
        })
        .returning();
      if (!image) throw new Error("Failed to create Entity image.");

      await tx
        .update(entities)
        .set({ updatedAt: new Date() })
        .where(eq(entities.id, entityId));
      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entityId,
        displayName: lockedEntity.name,
        actorId: actor.id,
        type: "update",
        data: {
          entityImage: {
            action: "add",
            id: image.id,
            caption: image.caption,
            sourceUrl: image.sourceUrl,
            license: image.license,
            isPrimary: image.isPrimary,
          },
        },
      });
      return { image, created: true };
    });
    if (!result.created) await deleteOwnedEntityImage(imageUrl);
    return result.image;
  } catch (error) {
    await deleteOwnedEntityImage(imageUrl);
    throw error;
  }
}

/** Changes image metadata or selects a different primary image. */
export async function updateEntityImage({
  entityId,
  imageId,
  caption,
  sourceUrl,
  license,
  makePrimary,
  user,
}: {
  entityId: number;
  imageId: number;
  caption?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  makePrimary?: true;
  user: User;
}): Promise<EntityImage> {
  return await db.transaction(async (tx) => {
    const [entity] = await tx
      .select({
        id: entities.id,
        name: entities.name,
      })
      .from(entities)
      .where(eq(entities.id, entityId))
      .for("update");
    if (!entity) throw new EntityImageNotFoundError("Entity");

    const actorId = (await getUserActorForDatabase(tx, user)).id;

    const [image] = await tx
      .select()
      .from(entityImages)
      .where(
        and(eq(entityImages.id, imageId), eq(entityImages.entityId, entityId)),
      );
    if (!image) throw new EntityImageNotFoundError("Image");

    const data: Partial<typeof entityImages.$inferInsert> = {};
    if (caption !== undefined && caption !== image.caption) {
      data.caption = caption;
    }
    if (sourceUrl !== undefined && sourceUrl !== image.sourceUrl) {
      data.sourceUrl = sourceUrl;
    }
    if (license !== undefined && license !== image.license) {
      data.license = license;
    }
    if (makePrimary && !image.isPrimary) {
      await tx
        .update(entityImages)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(entityImages.entityId, entityId),
            ne(entityImages.id, imageId),
          ),
        );
      data.isPrimary = true;
    }
    if (!Object.keys(data).length) return image;
    data.updatedAt = new Date();

    const [updatedImage] = await tx
      .update(entityImages)
      .set(data)
      .where(eq(entityImages.id, imageId))
      .returning();
    if (!updatedImage) throw new EntityImageNotFoundError("Image");

    await tx
      .update(entities)
      .set({ updatedAt: new Date() })
      .where(eq(entities.id, entityId));
    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entityId,
      displayName: entity.name,
      actorId,
      type: "update",
      data: {
        entityImage: {
          action: "update",
          id: imageId,
          ...data,
        },
      },
    });
    return updatedImage;
  });
}

/** Removes one image and promotes the oldest remaining image when needed. */
export async function deleteEntityImage({
  entityId,
  imageId,
  user,
}: {
  entityId: number;
  imageId: number;
  user: User;
}): Promise<void> {
  const deletedImage = await db.transaction(async (tx) => {
    const [entity] = await tx
      .select({
        id: entities.id,
        name: entities.name,
      })
      .from(entities)
      .where(eq(entities.id, entityId))
      .for("update");
    if (!entity) throw new EntityImageNotFoundError("Entity");

    const actorId = (await getUserActorForDatabase(tx, user)).id;

    const [image] = await tx
      .select()
      .from(entityImages)
      .where(
        and(eq(entityImages.id, imageId), eq(entityImages.entityId, entityId)),
      );
    if (!image) throw new EntityImageNotFoundError("Image");

    await tx.delete(entityImages).where(eq(entityImages.id, image.id));
    if (image.isPrimary) {
      const [replacement] = await tx
        .select({ id: entityImages.id })
        .from(entityImages)
        .where(eq(entityImages.entityId, entityId))
        .orderBy(asc(entityImages.createdAt), asc(entityImages.id))
        .limit(1);
      if (replacement) {
        await tx
          .update(entityImages)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(entityImages.id, replacement.id));
      }
    }

    await tx
      .update(entities)
      .set({ updatedAt: new Date() })
      .where(eq(entities.id, entityId));
    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entityId,
      displayName: entity.name,
      actorId,
      type: "update",
      data: {
        entityImage: {
          action: "delete",
          id: image.id,
          caption: image.caption,
          isPrimary: image.isPrimary,
        },
      },
    });
    return image;
  });

  await deleteOwnedEntityImage(deletedImage.imageUrl);
}
