import { db } from "@peated/server/db";
import { memberReviews } from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("member reviews", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("creates and updates one review per member and queues summaries", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const created = await routerClient.memberReviews.save(
      { bottle: bottle.id, score: 88, notes: "Bright fruit." },
      { context: { user: defaults.user } },
    );
    const updated = await routerClient.memberReviews.save(
      { bottle: bottle.id, score: 90, notes: null },
      { context: { user: defaults.user } },
    );

    expect(updated).toMatchObject({ id: created.id, score: 90, notes: null });
    await expect(
      routerClient.memberReviews.getMy(
        { bottle: bottle.id },
        { context: { user: defaults.user } },
      ),
    ).resolves.toMatchObject({ id: created.id, score: 90, notes: null });
    await expect(
      db.query.memberReviews.findMany({
        where: and(
          eq(memberReviews.bottleId, bottle.id),
          eq(memberReviews.createdById, defaults.user.id),
        ),
      }),
    ).resolves.toHaveLength(1);
    expect(workerClient.pushJob).toHaveBeenLastCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  });

  test("rejects invalid scores", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    for (const score of [-1, 101, 88.5]) {
      await expect(
        routerClient.memberReviews.save(
          { bottle: bottle.id, score, notes: null },
          { context: { user: defaults.user } },
        ),
      ).rejects.toThrow("Input validation failed");
    }
  });

  test("attaches an owned photo-entry image when saving", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
    });

    const review = await routerClient.memberReviews.save(
      {
        bottle: bottle.id,
        score: 91,
        notes: null,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(review.imageUrl).toContain(
      `/uploads/member-reviews/member_review-${review.id}-`,
    );
  });

  test("uploads and removes my review image", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await routerClient.memberReviews.save(
      { bottle: bottle.id, score: 87, notes: null },
      { context: { user: defaults.user } },
    );
    const oldUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    await db
      .update(memberReviews)
      .set({ updatedAt: oldUpdatedAt })
      .where(eq(memberReviews.bottleId, bottle.id));

    const withImage = await routerClient.memberReviews.imageUpdate(
      { bottle: bottle.id, file: await fixtures.SampleSquareImage() },
      { context: { user: defaults.user } },
    );
    expect(withImage.imageUrl).toMatch(/\.webp$/);
    expect(withImage.updatedAt).not.toBe(oldUpdatedAt.toISOString());
    await expect(
      db.query.memberReviews.findFirst({
        where: eq(memberReviews.id, withImage.id),
      }),
    ).resolves.toMatchObject({ imageUrl: expect.stringMatching(/\.webp$/) });

    await db
      .update(memberReviews)
      .set({ updatedAt: oldUpdatedAt })
      .where(eq(memberReviews.id, withImage.id));

    const withoutImage = await routerClient.memberReviews.imageDelete(
      { bottle: bottle.id },
      { context: { user: defaults.user } },
    );
    expect(withoutImage.imageUrl).toBeNull();
    expect(withoutImage.updatedAt).not.toBe(oldUpdatedAt.toISOString());
  });

  test("cannot update another member's review image", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const other = await fixtures.User();
    await routerClient.memberReviews.save(
      { bottle: bottle.id, score: 87, notes: null },
      { context: { user: other } },
    );

    expect(
      await waitError(() =>
        routerClient.memberReviews.imageUpdate(
          { bottle: bottle.id, file: new Blob(["not read"]) },
          { context: { user: defaults.user } },
        ),
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
  });

  test("only the owner can delete a review", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const other = await fixtures.User();
    await routerClient.memberReviews.save(
      { bottle: bottle.id, score: 86, notes: null },
      { context: { user: defaults.user } },
    );

    expect(
      await waitError(() =>
        routerClient.memberReviews.delete(
          { bottle: bottle.id },
          { context: { user: other } },
        ),
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
    await routerClient.memberReviews.delete(
      { bottle: bottle.id },
      { context: { user: defaults.user } },
    );
    await expect(
      db.query.memberReviews.findFirst({
        where: eq(memberReviews.bottleId, bottle.id),
      }),
    ).resolves.toBeUndefined();
  });

  test("hides private authors from strangers but always counts their score", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const privateMember = await fixtures.User({ private: true });
    const stranger = await fixtures.User();
    await routerClient.memberReviews.save(
      { bottle: bottle.id, score: 93, notes: "Private notes." },
      { context: { user: privateMember } },
    );

    await expect(
      routerClient.memberReviews.list({ bottle: bottle.id }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      routerClient.memberReviews.list(
        { bottle: bottle.id },
        { context: { user: stranger } },
      ),
    ).resolves.toMatchObject({ results: [] });

    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: privateMember.id,
      status: "following",
    });
    await expect(
      routerClient.memberReviews.list(
        { bottle: bottle.id },
        { context: { user: defaults.user } },
      ),
    ).resolves.toMatchObject({
      results: [{ score: 93, createdBy: { id: privateMember.id } }],
    });

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      memberScoreCount: 1,
      externalScoreCount: 0,
      medianScore: 93,
    });
  });
});
