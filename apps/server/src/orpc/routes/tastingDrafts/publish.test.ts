import { faker } from "@faker-js/faker";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleTombstones,
  tastingDrafts,
  tastings,
} from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

function storedFile(imageUrl: string) {
  return path.join(config.UPLOAD_PATH, imageUrl.replace(/^\/uploads\//, ""));
}

describe("POST /tasting-drafts/{draft}/publish", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("requires auth", async ({ fixtures }) => {
    const draft = await fixtures.TastingDraft();
    const error = await waitError(() =>
      routerClient.tastingDrafts.publish({ draft: draft.id }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("posts the draft as a tasting and deletes the draft", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ statedAge: 5 });
    await fixtures.Badge({
      tracker: "bottle",
      checks: [{ type: "age", config: { minAge: 5, maxAge: 10 } }],
    });
    const friend = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: friend.id,
    });
    const upload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
    });
    const draftId = faker.string.uuid();
    const tastedAt = new Date("2025-11-20T21:30:00.000Z");
    await routerClient.tastingDrafts.upsert(
      {
        draft: draftId,
        tastedAt: tastedAt.toISOString(),
        bottleHint: "the peaty one",
        bottle: bottle.id,
        notes: "smoke and pear",
        ratingBand: "outstanding",
        servingStyle: "neat",
        color: 4,
        friends: [friend.id],
        pendingImageId: upload.id,
      },
      { context: { user: defaults.user } },
    );
    const [draft] = await db
      .select()
      .from(tastingDrafts)
      .where(eq(tastingDrafts.id, draftId));

    const result = await routerClient.tastingDrafts.publish(
      { draft: draftId },
      { context: { user: defaults.user } },
    );

    expect(result.awards).toHaveLength(1);
    expect(result.tasting).toMatchObject({
      bottle: { id: bottle.id },
      notes: "smoke and pear",
      ratingBand: "outstanding",
      servingStyle: "neat",
      color: 4,
      friends: [{ id: friend.id }],
      tastedAt: tastedAt.toISOString(),
    });
    const tasting = await db.query.tastings.findFirst({
      where: eq(tastings.id, result.tasting.id),
    });
    expect(tasting).toMatchObject({
      createdById: defaults.user.id,
      idempotencyKey: draftId,
      tastedAt,
      imageUrl: `/uploads/tastings/draft-${draftId}${path.posix.extname(draft.imageUrl!)}`,
    });
    expect(tasting!.createdAt.getTime()).toBeGreaterThan(tastedAt.getTime());
    expect(existsSync(storedFile(tasting!.imageUrl!))).toBe(true);

    expect(
      await db
        .select()
        .from(tastingDrafts)
        .where(eq(tastingDrafts.id, draftId)),
    ).toEqual([]);
    expect(existsSync(storedFile(draft.imageUrl!))).toBe(false);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      expect.anything(),
    );
  });

  test("returns the same tasting with no awards when retried", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const draft = await fixtures.TastingDraft({
      createdById: defaults.user.id,
      bottleId: bottle.id,
    });

    const first = await routerClient.tastingDrafts.publish(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );
    const retry = await routerClient.tastingDrafts.publish(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );

    expect(retry.tasting.id).toBe(first.tasting.id);
    expect(retry.awards).toEqual([]);
    expect(
      await db
        .select()
        .from(tastings)
        .where(eq(tastings.createdById, defaults.user.id)),
    ).toHaveLength(1);

    // A stale save after posting cannot bring the draft back.
    const error = await waitError(() =>
      routerClient.tastingDrafts.upsert(
        { draft: draft.id, tastedAt: new Date().toISOString() },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchObject({
      code: "CONFLICT",
      data: { tasting: first.tasting.id },
    });
  });

  test("requires a Bottle", async ({ defaults, fixtures }) => {
    const draft = await fixtures.TastingDraft({
      createdById: defaults.user.id,
      bottleHint: "not sure yet",
    });

    const error = await waitError(() =>
      routerClient.tastingDrafts.publish(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Choose a bottle before posting this draft.]`,
    );
    expect(
      await db
        .select()
        .from(tastingDrafts)
        .where(eq(tastingDrafts.id, draft.id)),
    ).toHaveLength(1);
    expect(await db.select().from(tastings)).toEqual([]);
  });

  test("removes the photo copy when posting fails", async ({
    defaults,
    fixtures,
  }) => {
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const upload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
    });
    const draftId = faker.string.uuid();
    await routerClient.tastingDrafts.upsert(
      {
        draft: draftId,
        tastedAt: new Date().toISOString(),
        bottle: retired.id,
        pendingImageId: upload.id,
      },
      { context: { user: defaults.user } },
    );
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    const [draft] = await db
      .select()
      .from(tastingDrafts)
      .where(eq(tastingDrafts.id, draftId));

    const error = await waitError(() =>
      routerClient.tastingDrafts.publish(
        { draft: draftId },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Cannot identify bottle.]`);
    expect(await db.select().from(tastings)).toEqual([]);
    expect(
      existsSync(
        storedFile(
          `/uploads/tastings/draft-${draftId}${path.posix.extname(draft.imageUrl!)}`,
        ),
      ),
    ).toBe(false);
    expect(existsSync(storedFile(draft.imageUrl!))).toBe(true);
  });

  test("rejects friends the member no longer follows", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const stranger = await fixtures.User();
    const draft = await fixtures.TastingDraft({
      createdById: defaults.user.id,
      bottleId: bottle.id,
      friends: [stranger.id],
    });

    const error = await waitError(() =>
      routerClient.tastingDrafts.publish(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Friends must all be active relationships.]`,
    );
    expect(await db.select().from(tastings)).toEqual([]);
  });

  test("returns not found for a draft that was never posted", async ({
    defaults,
  }) => {
    const error = await waitError(() =>
      routerClient.tastingDrafts.publish(
        { draft: faker.string.uuid() },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Draft not found.]`);
  });

  test("cannot publish another member's draft", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const draft = await fixtures.TastingDraft({ bottleId: bottle.id });

    const error = await waitError(() =>
      routerClient.tastingDrafts.publish(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Draft not found.]`);
    expect(
      await db
        .select()
        .from(tastingDrafts)
        .where(eq(tastingDrafts.id, draft.id)),
    ).toHaveLength(1);
    expect(await db.select().from(tastings)).toEqual([]);
  });
});
