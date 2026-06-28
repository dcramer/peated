import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { pendingUploads } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

function uploadPathFromUrl(imageUrl: string) {
  return new URL(imageUrl).pathname.slice("/uploads/".length);
}

describe("POST /pending-uploads", () => {
  test("requires authentication", async ({ fixtures }) => {
    const err = await waitError(
      routerClient.pendingUploads.create({
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "requires-authentication",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a processed pending upload", async ({ fixtures, defaults }) => {
    const response = await routerClient.pendingUploads.create(
      {
        file: await fixtures.SampleSquareImage(),
        purpose: "photo_tasting_entry",
        idempotencyKey: "create-pending-upload",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.id).toBeDefined();
    expect(response.kind).toBe("image");
    expect(response.purpose).toBe("photo_tasting_entry");
    expect(response.status).toBe("pending");

    const uploadPath = uploadPathFromUrl(response.imageUrl);
    expect(uploadPath.startsWith("pending-uploads/")).toBe(true);
    expect(path.extname(uploadPath)).toBe(".webp");

    const filepath = path.join(config.UPLOAD_PATH, uploadPath);
    await expect(access(filepath)).resolves.toBeUndefined();

    const metadata = await sharp(filepath).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.height).toBeLessThanOrEqual(1600);
    expect(metadata.width).toBeLessThanOrEqual(1600);

    const [pendingUpload] = await db
      .select()
      .from(pendingUploads)
      .where(eq(pendingUploads.id, response.id))
      .limit(1);

    expect(pendingUpload).toMatchObject({
      createdById: defaults.user.id,
      imageUrl: `/${new URL(response.imageUrl).pathname.split("/").slice(1).join("/")}`,
      namespace: "pending-uploads",
      kind: "image",
      purpose: "photo_tasting_entry",
      status: "pending",
    });
  });

  test("reuses pending upload for idempotent retries", async ({
    fixtures,
    defaults,
  }) => {
    const first = await routerClient.pendingUploads.create(
      {
        file: await fixtures.SampleSquareImage(),
        purpose: "photo_tasting_entry",
        idempotencyKey: "retry-key",
      },
      {
        context: { user: defaults.user },
      },
    );
    const second = await routerClient.pendingUploads.create(
      {
        file: await fixtures.SampleSquareImage(),
        purpose: "photo_tasting_entry",
        idempotencyKey: "retry-key",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(second.id).toBe(first.id);

    const rows = await db
      .select()
      .from(pendingUploads)
      .where(eq(pendingUploads.createdById, defaults.user.id));
    expect(rows).toHaveLength(1);
  });

  test("reuses pending upload for concurrent idempotent retries", async ({
    fixtures,
    defaults,
  }) => {
    const [first, second] = await Promise.all([
      routerClient.pendingUploads.create(
        {
          file: await fixtures.SampleSquareImage(),
          purpose: "photo_tasting_entry",
          idempotencyKey: "concurrent-retry-key",
        },
        {
          context: { user: defaults.user },
        },
      ),
      routerClient.pendingUploads.create(
        {
          file: await fixtures.SampleSquareImage(),
          purpose: "photo_tasting_entry",
          idempotencyKey: "concurrent-retry-key",
        },
        {
          context: { user: defaults.user },
        },
      ),
    ]);

    expect(second.id).toBe(first.id);

    const rows = await db
      .select()
      .from(pendingUploads)
      .where(eq(pendingUploads.createdById, defaults.user.id));
    expect(rows).toHaveLength(1);
  });

  test("requires an idempotency key", async ({ fixtures, defaults }) => {
    const err = await waitError(
      routerClient.pendingUploads.create(
        // @ts-expect-error exercising runtime validation for malformed clients
        {
          file: await fixtures.SampleSquareImage(),
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("rejects oversized files before storing", async ({ defaults }) => {
    const err = await waitError(
      routerClient.pendingUploads.create(
        {
          file: new Blob([new Uint8Array(MAX_FILESIZE + 1)]),
          idempotencyKey: "oversized-file",
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: File exceeded maximum upload size of 20.0 MiB.]`,
    );
  });
});
