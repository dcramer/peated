import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { pendingUploads } from "@peated/server/db/schema";
import {
  cleanupPendingUploads,
  copyPendingImageToBottle,
  copyPendingImageToCollectionBottle,
  copyPendingImageToTasting,
  createPendingImageUpload,
  PendingUploadExpiredError,
  PendingUploadNotFoundError,
  PendingUploadPurposeError,
} from "@peated/server/lib/pendingUploads";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { eq } from "drizzle-orm";
import { access } from "node:fs/promises";
import path from "node:path";

function relativeUploadPath(imageUrl: string) {
  return imageUrl.slice("/uploads/".length);
}

describe("pending uploads", () => {
  test("copies owned pending upload into a tasting destination", async ({
    fixtures,
    defaults,
  }) => {
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const imageUrl = await copyPendingImageToTasting({
      id: pendingUpload.id,
      userId: defaults.user.id,
      purpose: "photo_tasting_entry",
      tastingId: 123,
    });

    expect(imageUrl).toMatch(
      /^\/uploads\/tastings\/tasting-123-pending-upload-.+\.webp$/,
    );
    await expect(
      access(path.join(config.UPLOAD_PATH, relativeUploadPath(imageUrl))),
    ).resolves.toBeUndefined();

    const updated = await db.query.pendingUploads.findFirst({
      where: eq(pendingUploads.id, pendingUpload.id),
    });

    expect(updated).toMatchObject({
      status: "attached",
      attachedToType: null,
      attachedToId: null,
    });
  });

  test("copies the same pending upload to collection bottle and tasting destinations", async ({
    fixtures,
    defaults,
  }) => {
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const collectionImageUrl = await copyPendingImageToCollectionBottle({
      id: pendingUpload.id,
      userId: defaults.user.id,
      purpose: "photo_tasting_entry",
      collectionBottleId: 101,
    });
    const tastingImageUrl = await copyPendingImageToTasting({
      id: pendingUpload.id,
      userId: defaults.user.id,
      purpose: "photo_tasting_entry",
      tastingId: 202,
    });

    expect(collectionImageUrl).toMatch(
      /^\/uploads\/collection-bottles\/collection_bottle-101-pending-upload-.+\.webp$/,
    );
    expect(tastingImageUrl).toMatch(
      /^\/uploads\/tastings\/tasting-202-pending-upload-.+\.webp$/,
    );
    expect(collectionImageUrl).not.toBe(tastingImageUrl);
    const updated = await db.query.pendingUploads.findFirst({
      where: eq(pendingUploads.id, pendingUpload.id),
    });
    expect(updated).toMatchObject({
      status: "attached",
      attachedToType: null,
      attachedToId: null,
    });
    await expect(
      access(
        path.join(config.UPLOAD_PATH, relativeUploadPath(collectionImageUrl)),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(config.UPLOAD_PATH, relativeUploadPath(tastingImageUrl)),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(
          config.UPLOAD_PATH,
          relativeUploadPath(pendingUpload.imageUrl),
        ),
      ),
    ).resolves.toBeUndefined();
  });

  test("copies the same pending upload to collection bottle and catalog destinations", async ({
    fixtures,
    defaults,
  }) => {
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const collectionImageUrl = await copyPendingImageToCollectionBottle({
      id: pendingUpload.id,
      userId: defaults.user.id,
      purpose: "photo_tasting_entry",
      collectionBottleId: 303,
    });
    const bottleImageUrl = await copyPendingImageToBottle({
      id: pendingUpload.id,
      userId: defaults.user.id,
      purpose: "photo_tasting_entry",
      bottleId: 404,
    });

    expect(collectionImageUrl).toMatch(
      /^\/uploads\/collection-bottles\/collection_bottle-303-pending-upload-.+\.webp$/,
    );
    expect(bottleImageUrl).toMatch(
      /^\/uploads\/bottles\/bottle-404-pending-upload-.+\.webp$/,
    );
    expect(collectionImageUrl).not.toBe(bottleImageUrl);
    await expect(
      access(
        path.join(config.UPLOAD_PATH, relativeUploadPath(collectionImageUrl)),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(config.UPLOAD_PATH, relativeUploadPath(bottleImageUrl))),
    ).resolves.toBeUndefined();
  });

  test("rejects pending uploads owned by another user", async ({
    fixtures,
    defaults,
  }) => {
    const otherUser = await fixtures.User();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: otherUser.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    await expect(
      copyPendingImageToTasting({
        id: pendingUpload.id,
        userId: defaults.user.id,
        purpose: "photo_tasting_entry",
        tastingId: 123,
      }),
    ).rejects.toBeInstanceOf(PendingUploadNotFoundError);
  });

  test("rejects expired pending uploads", async ({ fixtures, defaults }) => {
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      ttlMs: -1000,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    await expect(
      copyPendingImageToTasting({
        id: pendingUpload.id,
        userId: defaults.user.id,
        purpose: "photo_tasting_entry",
        tastingId: 123,
      }),
    ).rejects.toBeInstanceOf(PendingUploadExpiredError);
  });

  test("rejects pending uploads for another purpose", async ({
    fixtures,
    defaults,
  }) => {
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "avatar",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    await expect(
      copyPendingImageToTasting({
        id: pendingUpload.id,
        userId: defaults.user.id,
        purpose: "photo_tasting_entry",
        tastingId: 123,
      }),
    ).rejects.toBeInstanceOf(PendingUploadPurposeError);
  });

  test("deletes the stored object when pending upload row creation fails", async ({
    fixtures,
    defaults,
  }) => {
    let storedFilename = "";

    await expect(
      createPendingImageUpload({
        file: await fixtures.SampleSquareImage(),
        createdById: defaults.user.id,
        purpose: "invalid_purpose" as any,
        onProcess: (stream, filename) => {
          storedFilename = `${filename}.jpg`;
          return { stream, filename: storedFilename };
        },
      }),
    ).rejects.toThrow();

    expect(storedFilename).toBeTruthy();
    await expect(
      access(path.join(config.UPLOAD_PATH, "pending-uploads", storedFilename)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("cleanup keeps reusable copied sources until expiry", async ({
    fixtures,
    defaults,
  }) => {
    const expiredPending = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      ttlMs: -1000,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    const attachedPending = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    const copiedImageUrl = await copyPendingImageToTasting({
      id: attachedPending.id,
      userId: defaults.user.id,
      purpose: "photo_tasting_entry",
      tastingId: 1,
    });

    const result = await cleanupPendingUploads();

    expect(result).toEqual({ expired: 1, deletedAttached: 0 });

    const expiredRow = await db.query.pendingUploads.findFirst({
      where: eq(pendingUploads.id, expiredPending.id),
    });
    expect(expiredRow?.status).toBe("expired");

    await expect(
      access(
        path.join(
          config.UPLOAD_PATH,
          relativeUploadPath(expiredPending.imageUrl),
        ),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      access(
        path.join(
          config.UPLOAD_PATH,
          relativeUploadPath(attachedPending.imageUrl),
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(config.UPLOAD_PATH, relativeUploadPath(copiedImageUrl))),
    ).resolves.toBeUndefined();

    await db
      .update(pendingUploads)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(pendingUploads.id, attachedPending.id));

    await expect(cleanupPendingUploads()).resolves.toEqual({
      expired: 0,
      deletedAttached: 1,
    });

    await expect(
      access(
        path.join(
          config.UPLOAD_PATH,
          relativeUploadPath(attachedPending.imageUrl),
        ),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      access(path.join(config.UPLOAD_PATH, relativeUploadPath(copiedImageUrl))),
    ).resolves.toBeUndefined();

    await expect(cleanupPendingUploads()).resolves.toEqual({
      expired: 0,
      deletedAttached: 0,
    });
  });
});
