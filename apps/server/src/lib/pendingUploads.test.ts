import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { pendingUploads } from "@peated/server/db/schema";
import {
  cleanupPendingUploads,
  copyPendingUploadToPermanent,
  createPendingImageUpload,
  PendingUploadExpiredError,
  PendingUploadNotFoundError,
} from "@peated/server/lib/pendingUploads";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { and, eq } from "drizzle-orm";
import { access } from "node:fs/promises";
import path from "node:path";

function relativeUploadPath(imageUrl: string) {
  return imageUrl.slice("/uploads/".length);
}

describe("pending uploads", () => {
  test("copies owned pending upload into a permanent namespace", async ({
    fixtures,
    defaults,
  }) => {
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const imageUrl = await copyPendingUploadToPermanent({
      id: pendingUpload.id,
      userId: defaults.user.id,
      destinationNamespace: "tastings",
      attachedToType: "tasting",
      attachedToId: 123,
    });

    expect(imageUrl).toMatch(/^\/uploads\/tastings\/pending-upload-.+\.webp$/);
    await expect(
      access(path.join(config.UPLOAD_PATH, relativeUploadPath(imageUrl))),
    ).resolves.toBeUndefined();

    const updated = await db.query.pendingUploads.findFirst({
      where: eq(pendingUploads.id, pendingUpload.id),
    });

    expect(updated).toMatchObject({
      status: "attached",
      attachedToType: "tasting",
      attachedToId: 123,
    });
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
      copyPendingUploadToPermanent({
        id: pendingUpload.id,
        userId: defaults.user.id,
        destinationNamespace: "tastings",
        attachedToType: "tasting",
        attachedToId: 123,
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
      copyPendingUploadToPermanent({
        id: pendingUpload.id,
        userId: defaults.user.id,
        destinationNamespace: "tastings",
        attachedToType: "tasting",
        attachedToId: 123,
      }),
    ).rejects.toBeInstanceOf(PendingUploadExpiredError);
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

  test("cleanup expires pending rows and deletes attached pending objects", async ({
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
    await db
      .update(pendingUploads)
      .set({ status: "attached", attachedToType: "tasting", attachedToId: 1 })
      .where(eq(pendingUploads.id, attachedPending.id));

    const result = await cleanupPendingUploads();

    expect(result).toEqual({ expired: 1, deletedAttached: 1 });

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
    ).rejects.toMatchObject({ code: "ENOENT" });

    await expect(cleanupPendingUploads()).resolves.toEqual({
      expired: 0,
      deletedAttached: 0,
    });

    const attachedRows = await db
      .select()
      .from(pendingUploads)
      .where(
        and(
          eq(pendingUploads.createdById, defaults.user.id),
          eq(pendingUploads.status, "attached"),
        ),
      );
    expect(attachedRows).toHaveLength(1);
  });
});
