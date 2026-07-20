import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleReleasePromotions,
  catalogTargets,
  externalSites,
  incomingBottleDecisionLogs,
  reviews,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { describe, expect, test } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for review update to request its lock.");
}

async function promoteRelease(releaseId: number, promotedBottleId: number) {
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId,
    status: "promoted",
    completedAt: new Date(),
  });
}

describe("PATCH /reviews/:review", () => {
  test("requires mod role", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });
    const review = await fixtures.Review();

    const err = await waitError(
      routerClient.reviews.update(
        { review: review.id, hidden: true },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates hidden status to true", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.hidden).toBe(true);
    expect(updatedReview.targetId).toBe(review.targetId);
  });

  test("updates hidden status to false", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: true });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, hidden: false },
      { context: { user } },
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.hidden).toBe(false);
  });

  test("reuses the same implicit external site across review fixtures", async ({
    fixtures,
  }) => {
    const firstReview = await fixtures.Review();
    const secondReview = await fixtures.Review();

    expect(secondReview.externalSiteId).toBe(firstReview.externalSiteId);

    const allSites = await db.select().from(externalSites);
    expect(allSites).toHaveLength(1);
  });

  test("assigns a release and infers the parent bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} - Batch 4`,
      name: `${bottle.name} - Batch 4`,
      edition: "Batch 4",
    });
    const promotedBottle = await fixtures.Bottle({
      fullName: release.fullName,
      name: release.name,
      edition: release.edition,
    });
    await promoteRelease(release.id, promotedBottle.id);
    const review = await fixtures.Review({ bottleId: null, releaseId: null });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, release: release.id },
      { context: { user } },
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.bottleId).toBe(bottle.id);
    expect(updatedReview.releaseId).toBe(release.id);
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, promotedBottle.id),
    });
    expect(updatedReview.targetId).toBe(target?.id);
    expect(newReviewData.target).toMatchObject({
      kind: "bottle",
      targetId: target?.id,
      bottle: { id: promotedBottle.id },
    });

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, review.id),
      ),
    });
    expect(decisionLog).toMatchObject({
      decision: "match_existing",
      bottleId: bottle.id,
      releaseId: release.id,
      createdBottle: false,
      createdRelease: false,
    });
  });

  test("clears release when changing the bottle without an explicit release", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.LegacyBottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} - Batch 4`,
      name: `${bottle.name} - Batch 4`,
      edition: "Batch 4",
    });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
    });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, bottle: otherBottle.id },
      { context: { user } },
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.bottleId).toBe(otherBottle.id);
    expect(updatedReview.releaseId).toBeNull();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, otherBottle.id),
    });
    expect(updatedReview.targetId).toBe(target?.id);
    expect(newReviewData.target).toMatchObject({
      kind: "bottle",
      targetId: target?.id,
      bottle: { id: otherBottle.id },
    });
  });

  test("rejects mismatched bottle and release updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      hidden: false,
    });

    const err = await waitError(
      routerClient.reviews.update(
        {
          review: review.id,
          bottle: otherBottle.id,
          release: release.id,
          hidden: true,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Release does not belong to the selected bottle.]`,
    );
    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: null,
      bottleId: null,
      releaseId: null,
      hidden: false,
    });
  });

  test("returns NOT_FOUND for a nonexistent explicit bottle without partial writes", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const error = await waitError(
      routerClient.reviews.update(
        { review: review.id, bottle: 999999, hidden: true },
        { context: { user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Bottle not found.]`);

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: review.targetId,
      bottleId: review.bottleId,
      releaseId: review.releaseId,
      hidden: false,
    });
  });

  test("assigns the generic target when clearing a release from a parent with releases", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
    });

    await routerClient.reviews.update(
      { review: review.id, release: null },
      { context: { user } },
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { and, eq, isNull }) =>
        and(eq(targets.groupId, bottle.groupId!), isNull(targets.bottleId)),
    });
    expect(persisted).toMatchObject({
      targetId: genericTarget?.id,
      bottleId: bottle.id,
      releaseId: null,
    });
  });

  test("clears the complete identity tuple", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target!.id,
    });

    await routerClient.reviews.update(
      { review: review.id, bottle: null },
      { context: { user } },
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: null,
      bottleId: null,
      releaseId: null,
    });
  });

  test("preserves a durable target and drifted retained pair during hidden-only updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.LegacyBottle();
    const otherRetainedBottle = await fixtures.LegacyBottle();
    const mismatchedRelease = await fixtures.BottleRelease({
      bottleId: otherRetainedBottle.id,
    });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const review = await fixtures.Review({
      bottleId: retainedBottle.id,
      releaseId: mismatchedRelease.id,
      targetId: target!.id,
      hidden: false,
    });

    await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: target!.id,
      bottleId: retainedBottle.id,
      releaseId: mismatchedRelease.id,
      hidden: true,
    });
  });

  test("preserves a durable target with a null retained pair during hidden-only updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const review = await fixtures.Review({
      targetId: target!.id,
      bottleId: null,
      releaseId: null,
      hidden: false,
    });

    await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: target!.id,
      bottleId: null,
      releaseId: null,
      hidden: true,
    });
  });

  test("rejects an identity correction without a valid target and writes nothing", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const legacyBottle = await fixtures.LegacyBottle();
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      targetId: null,
      hidden: false,
    });

    const error = await waitError(
      routerClient.reviews.update(
        { review: review.id, bottle: legacyBottle.id, hidden: true },
        { context: { user } },
      ),
    );
    expect(error.message).toContain(
      "legacy parent has not been assigned to a BottleGroup",
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: null,
      bottleId: null,
      releaseId: null,
      hidden: false,
    });
  });

  test("repairs a null target from the retained pair during hidden-only updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: null,
      targetId: null,
      hidden: false,
    });

    await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
    );

    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: target?.id,
      bottleId: bottle.id,
      releaseId: null,
      hidden: true,
    });
  });

  test("leaves an unpromoted retained pair targetless during hidden-only updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
      hidden: false,
    });

    await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: null,
      bottleId: bottle.id,
      releaseId: release.id,
      hidden: true,
    });
  });

  test("leaves an ungrouped retained parent targetless during hidden-only updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.LegacyBottle();
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: null,
      targetId: null,
      hidden: false,
    });

    await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: null,
      bottleId: bottle.id,
      releaseId: null,
      hidden: true,
    });
  });

  test("rejects a targetless mismatched retained pair without partial writes", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.LegacyBottle();
    const otherBottle = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({ bottleId: otherBottle.id });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
      hidden: false,
    });

    const error = await waitError(
      routerClient.reviews.update(
        { review: review.id, hidden: true },
        { context: { user } },
      ),
    );
    expect(error.message).toContain(
      "release does not belong to the supplied parent Bottle",
    );

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: null,
      bottleId: bottle.id,
      releaseId: release.id,
      hidden: false,
    });
  });

  test("retries from the locked identity after a concurrent correction", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const originalBottle = await fixtures.Bottle();
    const correctedBottle = await fixtures.Bottle();
    const originalTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, originalBottle.id),
    });
    const correctedTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, correctedBottle.id),
    });
    const review = await fixtures.Review({
      bottleId: originalBottle.id,
      releaseId: null,
      targetId: originalTarget!.id,
      hidden: false,
    });

    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let updatePromise:
      | ReturnType<typeof routerClient.reviews.update>
      | undefined;
    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        'UPDATE "review" SET "target_id" = $1, "bottle_id" = $2, "release_id" = NULL WHERE "id" = $3',
        [correctedTarget!.id, correctedBottle.id, review.id],
      );

      updatePromise = routerClient.reviews.update(
        { review: review.id, hidden: true },
        { context: { user } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      await updatePromise;
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await updatePromise?.catch(() => undefined);
    }

    const persisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(persisted).toMatchObject({
      targetId: correctedTarget!.id,
      bottleId: correctedBottle.id,
      releaseId: null,
      hidden: true,
    });
  });

  test("returns NOT_FOUND for non-existent review", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.reviews.update(
        { review: 999999, hidden: true },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Review not found.]`);
  });

  test("returns existing review if no data is sent", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id }, // no actual update data (hidden is optional)
      { context: { user } },
    );

    expect(newReviewData.id).toBe(review.id);
  });
});
