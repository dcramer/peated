import { faker } from "@faker-js/faker";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleTombstones, tastingDrafts } from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { MAX_TASTING_DRAFTS_PER_USER } from "./shared";

function storedFile(imageUrl: string) {
  return path.join(config.UPLOAD_PATH, imageUrl.replace(/^\/uploads\//, ""));
}

async function getDraftRow(id: string) {
  return await db.query.tastingDrafts.findFirst({
    where: eq(tastingDrafts.id, id),
  });
}

describe("PUT /tasting-drafts/{draft}", () => {
  test("requires auth", async () => {
    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert({
        draft: faker.string.uuid(),
        tastedAt: new Date().toISOString(),
      }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires accepted terms", async ({ fixtures }) => {
    const user = await fixtures.User({ termsAcceptedAt: null });
    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert(
        { draft: faker.string.uuid(), tastedAt: new Date().toISOString() },
        { context: { user } },
      ),
    );
    expect(error).toMatchObject({ status: 403 });
  });

  test("creates a draft with only a tasted time and a bottle hint", async ({
    defaults,
  }) => {
    const draftId = faker.string.uuid();
    const tastedAt = new Date("2026-01-02T03:04:05.000Z");

    const draft = await routerClient.tastingDrafts.upsert(
      {
        draft: draftId,
        tastedAt: tastedAt.toISOString(),
        bottleHint: "  the smoky one at the bar  ",
      },
      { context: { user: defaults.user } },
    );

    expect(draft).toMatchObject({
      id: draftId,
      tastedAt: tastedAt.toISOString(),
      bottleHint: "the smoky one at the bar",
      bottle: null,
      imageUrl: null,
      tags: [],
      friends: [],
    });
    expect(await getDraftRow(draftId)).toMatchObject({
      createdById: defaults.user.id,
      tastedAt,
    });
  });

  test("replaces every field on a later save", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const friend = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: friend.id,
    });
    const tag = await fixtures.Tag();
    const draftId = faker.string.uuid();

    const first = await routerClient.tastingDrafts.upsert(
      {
        draft: draftId,
        tastedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        bottleHint: "something peaty",
        notes: "first notes",
      },
      { context: { user: defaults.user } },
    );

    const second = await routerClient.tastingDrafts.upsert(
      {
        draft: draftId,
        tastedAt: new Date("2026-01-03T00:00:00.000Z").toISOString(),
        bottle: bottle.id,
        ratingBand: "very_good",
        tags: [tag.name.toUpperCase()],
        servingStyle: "neat",
        color: 5,
        friends: [friend.id],
      },
      { context: { user: defaults.user } },
    );

    expect(second).toMatchObject({
      id: draftId,
      tastedAt: "2026-01-03T00:00:00.000Z",
      bottleHint: null,
      bottle: { id: bottle.id },
      notes: null,
      ratingBand: "very_good",
      tags: [tag.name],
      servingStyle: "neat",
      color: 5,
      friends: [{ id: friend.id }],
      createdAt: first.createdAt,
    });
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.updatedAt).getTime(),
    );
    expect(await db.select().from(tastingDrafts)).toHaveLength(1);
  });

  test("returns conflict when the ID belongs to another member", async ({
    defaults,
    fixtures,
  }) => {
    const other = await fixtures.TastingDraft({ notes: "theirs" });

    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert(
        {
          draft: other.id,
          tastedAt: new Date().toISOString(),
          notes: "mine",
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Draft ID is already in use.]`);
    expect(await getDraftRow(other.id)).toMatchObject({
      createdById: other.createdById,
      notes: "theirs",
    });
  });

  test("returns conflict with the tasting when the draft was already posted", async ({
    defaults,
    fixtures,
  }) => {
    const draftId = faker.string.uuid();
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      idempotencyKey: draftId,
    });

    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert(
        { draft: draftId, tastedAt: new Date().toISOString() },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: This draft was already posted.]`,
    );
    expect(error).toMatchObject({
      code: "CONFLICT",
      data: { tasting: tasting.id },
    });
    expect(await getDraftRow(draftId)).toBeUndefined();
  });

  test("rejects a retired Bottle", async ({ defaults, fixtures }) => {
    const source = await fixtures.Bottle();
    const destination = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: source.id,
      newBottleId: destination.id,
    });

    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert(
        {
          draft: faker.string.uuid(),
          tastedAt: new Date().toISOString(),
          bottle: source.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Cannot identify bottle.]`);
  });

  test("rejects friends the member does not follow", async ({
    defaults,
    fixtures,
  }) => {
    const stranger = await fixtures.User();

    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert(
        {
          draft: faker.string.uuid(),
          tastedAt: new Date().toISOString(),
          friends: [stranger.id],
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Friends must all be active relationships.]`,
    );
  });

  test("rejects a new draft past the per-member cap", async ({
    defaults,
    fixtures,
  }) => {
    await db.insert(tastingDrafts).values(
      Array.from({ length: MAX_TASTING_DRAFTS_PER_USER }, () => ({
        id: faker.string.uuid(),
        createdById: defaults.user.id,
        tastedAt: new Date(),
      })),
    );
    const [existing] = await db
      .select()
      .from(tastingDrafts)
      .where(eq(tastingDrafts.createdById, defaults.user.id))
      .limit(1);

    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert(
        { draft: faker.string.uuid(), tastedAt: new Date().toISOString() },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(
      `[Error: You have too many drafts. Post or delete some first.]`,
    );

    // Saving an existing draft still works at the cap.
    await routerClient.tastingDrafts.upsert(
      {
        draft: existing.id,
        tastedAt: new Date().toISOString(),
        notes: "still editable",
      },
      { context: { user: defaults.user } },
    );
    expect(await getDraftRow(existing.id)).toMatchObject({
      notes: "still editable",
    });

    // Another member is not affected.
    const other = await fixtures.User();
    await routerClient.tastingDrafts.upsert(
      { draft: faker.string.uuid(), tastedAt: new Date().toISOString() },
      { context: { user: other } },
    );
  });

  describe("photos", () => {
    async function pendingPhoto(
      userId: number,
      sampleImage: () => Promise<File>,
    ) {
      return await createPendingImageUpload({
        file: await sampleImage(),
        createdById: userId,
        purpose: "photo_tasting_entry",
      });
    }

    test("keeps, replaces, and removes the photo", async ({
      defaults,
      fixtures,
    }) => {
      const draftId = faker.string.uuid();
      const user = defaults.user;
      const tastedAt = new Date().toISOString();

      const firstUpload = await pendingPhoto(
        user.id,
        fixtures.SampleSquareImage,
      );
      await routerClient.tastingDrafts.upsert(
        { draft: draftId, tastedAt, pendingImageId: firstUpload.id },
        { context: { user } },
      );
      const firstUrl = (await getDraftRow(draftId))!.imageUrl!;
      expect(firstUrl).toMatch(
        new RegExp(`^/uploads/tasting-drafts/tasting_draft-${draftId}-`),
      );
      expect(existsSync(storedFile(firstUrl))).toBe(true);

      // Omitted keeps the photo.
      const kept = await routerClient.tastingDrafts.upsert(
        { draft: draftId, tastedAt, notes: "kept" },
        { context: { user } },
      );
      expect(kept.imageUrl).toContain(firstUrl);
      expect((await getDraftRow(draftId))!.imageUrl).toBe(firstUrl);

      // Sending the same upload again keeps the same file.
      await routerClient.tastingDrafts.upsert(
        { draft: draftId, tastedAt, pendingImageId: firstUpload.id },
        { context: { user } },
      );
      expect((await getDraftRow(draftId))!.imageUrl).toBe(firstUrl);
      expect(existsSync(storedFile(firstUrl))).toBe(true);

      // A new upload replaces the photo and deletes the old file.
      const secondUpload = await pendingPhoto(
        user.id,
        fixtures.SampleSquareImage,
      );
      await routerClient.tastingDrafts.upsert(
        { draft: draftId, tastedAt, pendingImageId: secondUpload.id },
        { context: { user } },
      );
      const secondUrl = (await getDraftRow(draftId))!.imageUrl!;
      expect(secondUrl).not.toBe(firstUrl);
      expect(existsSync(storedFile(secondUrl))).toBe(true);
      expect(existsSync(storedFile(firstUrl))).toBe(false);

      // null removes the photo and deletes the file.
      const removed = await routerClient.tastingDrafts.upsert(
        { draft: draftId, tastedAt, pendingImageId: null },
        { context: { user } },
      );
      expect(removed.imageUrl).toBeNull();
      expect((await getDraftRow(draftId))!.imageUrl).toBeNull();
      expect(existsSync(storedFile(secondUrl))).toBe(false);
    });

    test("rejects another member's pending upload", async ({
      defaults,
      fixtures,
    }) => {
      const other = await fixtures.User();
      const upload = await pendingPhoto(other.id, fixtures.SampleSquareImage);
      const draftId = faker.string.uuid();

      const error = await waitError(() =>
        routerClient.tastingDrafts.upsert(
          {
            draft: draftId,
            tastedAt: new Date().toISOString(),
            pendingImageId: upload.id,
          },
          { context: { user: defaults.user } },
        ),
      );

      expect(error).toMatchInlineSnapshot(`[Error: Pending upload not found.]`);
      expect(await getDraftRow(draftId)).toBeUndefined();
    });

    test("removes the new copy when the save fails", async ({
      defaults,
      fixtures,
    }) => {
      const other = await fixtures.TastingDraft();
      const upload = await pendingPhoto(
        defaults.user.id,
        fixtures.SampleSquareImage,
      );

      await waitError(() =>
        routerClient.tastingDrafts.upsert(
          {
            draft: other.id,
            tastedAt: new Date().toISOString(),
            pendingImageId: upload.id,
          },
          { context: { user: defaults.user } },
        ),
      );

      const copy = `/uploads/tasting-drafts/tasting_draft-${other.id}-${path.posix.basename(upload.imageUrl)}`;
      expect(existsSync(storedFile(copy))).toBe(false);
    });
  });
});
