import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  externalReviewArticles,
  externalReviews,
  memberReviews,
} from "@peated/server/db/schema";
import { loadScoredExternalReviews } from "@peated/server/externalReviews/scoredReviews";
import { loadReviewScoringSettings } from "@peated/server/externalReviews/scoringSettings";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import {
  REVIEW_SCORING_CONFIG_KEY,
  type ExternalReviewScoringPolicy,
} from "@peated/server/schemas";
import updateSiteReviewScores from "@peated/server/worker/jobs/updateSiteReviewScores";
import { eq } from "drizzle-orm";

const policy: ExternalReviewScoringPolicy = {
  enabled: true,
  rules: [
    {
      scale: 10,
      guideUrl: "https://example.com/guide",
      explanation: "This test site uses tenths of its 100-point score.",
      from: null,
      until: null,
      points: [
        { source: 0, target: 0 },
        { source: 10, target: 100 },
      ],
    },
  ],
};

test("combines fractional five-point scores with native and converted scores", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ mod: true });
  const site = await fixtures.ExternalSiteOrExisting({
    type: "whiskyadvocate",
  });
  const bottle = await fixtures.Bottle();
  const mixed: ExternalReviewScoringPolicy = {
    enabled: true,
    rules: [
      policy.rules[0],
      {
        ...policy.rules[0],
        scale: 5,
        points: [
          { source: 3, target: 82 },
          { source: 4, target: 90 },
        ],
      },
      {
        ...policy.rules[0],
        scale: 100,
        points: [
          { source: 0, target: 0 },
          { source: 100, target: 100 },
        ],
      },
    ],
  };
  for (const [value, scale] of [
    [3.5, 5],
    [8.7, 10],
    [84, 100],
    [2, 5],
  ]) {
    await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      hidden: false,
      nativeScoreValue: value,
      nativeScoreScale: scale,
      nativeScoreDisplay: `${value}/${scale}`,
    });
  }
  await routerClient.externalSites.reviewScoring.update(
    { site: site.type, expectedVersion: 0, policy: mixed },
    { context: { user } },
  );
  expect(await recomputeBottleStats(bottle.id)).toMatchObject({
    medianScore: 86,
    minScore: 84,
    maxScore: 87,
    externalScoreCount: 3,
  });
});

test("an older refresh cannot clear a newer pending change", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ mod: true });
  const site = await fixtures.ExternalSiteOrExisting({
    type: "whiskyadvocate",
  });
  const review = await fixtures.ExternalReview({
    externalSiteId: site.id,
    hidden: false,
    nativeScoreValue: 8,
    nativeScoreScale: 10,
    nativeScoreDisplay: "8/10",
  });
  await routerClient.externalSites.reviewScoring.update(
    { site: site.type, expectedVersion: 0, policy },
    { context: { user } },
  );
  // Ratings changes while the old job finishes related totals.
  pushJob.mockImplementationOnce(async () => {
    await routerClient.externalSites.reviewScoring.update(
      {
        site: site.type,
        expectedVersion: 1,
        policy: { enabled: false, rules: [] },
      },
      { context: { user } },
    );
  });
  await updateSiteReviewScores({ siteId: site.id });
  expect(
    (await loadReviewScoringSettings([site.id])).get(site.id),
  ).toMatchObject({ version: 2, recomputePending: true });
  await updateSiteReviewScores({ siteId: site.id });
  expect(
    (await loadReviewScoringSettings([site.id])).get(site.id)?.recomputePending,
  ).toBe(false);
  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, review.bottleId!),
    }),
  ).toMatchObject({ medianScore: null, externalScoreCount: 0 });
});

test("previews the complete bottle score, saves, refreshes bottles and groups, and preserves originals", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ mod: true });
  const site = await fixtures.ExternalSite({ type: "score-test" });
  await fixtures.ApprovedExternalReviewPublication({ externalSiteId: site.id });
  const bottle = await fixtures.Bottle();
  const review = await fixtures.ExternalReview({
    bottleId: bottle.id,
    externalSiteId: site.id,
    hidden: false,
    nativeScoreValue: 8.7,
    nativeScoreScale: 10,
    nativeScoreDisplay: "8.7/10",
  });
  await db
    .insert(memberReviews)
    .values({ bottleId: bottle.id, createdById: user.id, score: 91 });
  await recomputeBottleStats(bottle.id);
  const context = { user };

  const preview = await routerClient.externalSites.reviewScoring.preview(
    { site: site.type, policy },
    { context },
  );
  expect(preview).toMatchObject({
    version: 0,
    totalBottles: 1,
    samples: [
      {
        nativeScore: { value: 8.7, scale: 10 },
        before: { value: null },
        after: { value: 87 },
        contribution: { value: 87 },
      },
    ],
    bottles: [
      { before: { median: 91, count: 1 }, after: { median: 87, count: 2 } },
    ],
  });
  expect((await loadReviewScoringSettings([site.id])).size).toBe(0);
  expect(
    (await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }))
      ?.medianScore,
  ).toBe(91);

  const saved = await routerClient.externalSites.reviewScoring.update(
    { site: site.type, policy, expectedVersion: preview.version },
    { context },
  );
  expect(saved).toMatchObject({ version: 1, recomputePending: true });
  expect(pushJob).toHaveBeenCalledWith(
    "UpdateSiteReviewScores",
    { siteId: site.id },
    expect.anything(),
  );
  await updateSiteReviewScores({ siteId: site.id });
  expect(
    (await loadReviewScoringSettings([site.id])).get(site.id)?.recomputePending,
  ).toBe(false);
  expect(
    await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
  ).toMatchObject({
    medianScore: 87,
    externalScoreCount: 1,
    memberScoreCount: 1,
  });
  expect(
    await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, bottle.groupId),
    }),
  ).toMatchObject({ medianScore: 87, externalScoreCount: 1 });
  expect(
    await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    }),
  ).toMatchObject({
    nativeScoreValue: 8.7,
    nativeScoreScale: 10,
    nativeScoreDisplay: "8.7/10",
  });
  const publicReviews = await routerClient.externalReviews.list({
    sort: "name",
    bottle: bottle.id,
  });
  expect(publicReviews.results[0]).toMatchObject({
    nativeScore: { value: 8.7, scale: 10 },
    scoreContribution: { value: 87, reason: "counted" },
  });

  await db
    .update(externalReviews)
    .set({ nativeScoreValue: 9.2, nativeScoreDisplay: "9.2/10" })
    .where(eq(externalReviews.id, review.id));
  expect(await recomputeBottleStats(bottle.id)).toMatchObject({
    medianScore: 91,
    maxScore: 92,
  });
  await routerClient.externalSites.reviewScoring.update(
    {
      site: site.type,
      expectedVersion: 1,
      policy: { enabled: false, rules: policy.rules },
    },
    { context },
  );
  await updateSiteReviewScores({ siteId: site.id });
  expect(
    await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
  ).toMatchObject({ medianScore: 91, externalScoreCount: 0 });
  expect(
    (
      await routerClient.externalReviews.list({
        bottle: bottle.id,
        sort: "name",
      })
    ).results,
  ).toHaveLength(1);
});

test("requires a moderator, rejects stale saves and protects the reserved config", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSiteOrExisting({
    type: "whiskyadvocate",
  });
  const user = await fixtures.User();
  const mod = await fixtures.User({ mod: true });
  const admin = await fixtures.User({ admin: true });
  await expect(
    routerClient.externalSites.reviewScoring.get(
      { site: site.type },
      { context: { user } },
    ),
  ).rejects.toThrow("Unauthorized");
  await expect(
    routerClient.externalSites.reviewScoring.preview(
      { site: site.type, policy },
      { context: { user } },
    ),
  ).rejects.toThrow("Unauthorized");
  await expect(
    routerClient.externalSites.reviewScoring.update(
      { site: site.type, policy, expectedVersion: 0 },
      { context: { user } },
    ),
  ).rejects.toThrow("Unauthorized");
  await routerClient.externalSites.reviewScoring.update(
    { site: site.type, policy, expectedVersion: 0 },
    { context: { user: mod } },
  );
  await expect(
    routerClient.externalSites.reviewScoring.update(
      {
        site: site.type,
        policy: { enabled: false, rules: [] },
        expectedVersion: 0,
      },
      { context: { user: mod } },
    ),
  ).rejects.toThrow("Scoring settings changed");
  await expect(
    routerClient.externalSites.config.set(
      { site: site.type, key: REVIEW_SCORING_CONFIG_KEY, value: {} },
      { context: { user: admin } },
    ),
  ).rejects.toThrow();
  expect(
    (await loadReviewScoringSettings([site.id])).get(site.id)?.version,
  ).toBe(1);
});

test("missing, hidden, unpublished, and unmatched reviews never contribute", async ({
  fixtures,
}) => {
  const mod = await fixtures.User({ mod: true });
  const site = await fixtures.ExternalSite({ type: "review-score-exclusions" });
  await fixtures.ExternalReviewPublication({ externalSiteId: site.id });
  const bottle = await fixtures.Bottle();
  const values = {
    externalSiteId: site.id,
    bottleId: bottle.id,
    nativeScoreValue: 8.5,
    nativeScoreScale: 10,
    nativeScoreDisplay: "8.5/10",
    hidden: false,
  };
  const hidden = await fixtures.ExternalReview({ ...values, hidden: true });
  const unpublished = await fixtures.ExternalReview(values);
  await db
    .update(externalReviewArticles)
    .set({ contentHash: "unapproved" })
    .where(eq(externalReviewArticles.id, unpublished.articleId));
  const unmatched = await fixtures.ExternalReview({
    ...values,
    bottleId: null,
  });
  const missing = await fixtures.ExternalReview({
    ...values,
    nativeScoreValue: null,
    nativeScoreScale: null,
    nativeScoreDisplay: null,
  });
  await routerClient.externalSites.reviewScoring.update(
    { site: site.type, policy, expectedVersion: 0 },
    { context: { user: mod } },
  );
  const rows = await loadScoredExternalReviews({
    reviewIds: [hidden.id, unpublished.id, unmatched.id, missing.id],
  });
  expect(new Map(rows.map((row) => [row.id, row.contribution.reason]))).toEqual(
    new Map([
      [hidden.id, "not_public"],
      [unpublished.id, "not_public"],
      [unmatched.id, "unmatched"],
      [missing.id, "no_score"],
    ]),
  );
  expect(await recomputeBottleStats(bottle.id)).toMatchObject({
    medianScore: null,
    externalScoreCount: 0,
  });
});

test("keeps a failed queue dispatch visible and allows retry", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ mod: true });
  const site = await fixtures.ExternalSiteOrExisting({
    type: "whiskyadvocate",
  });
  pushJob.mockRejectedValueOnce(new Error("Queue unavailable"));
  const result = await routerClient.externalSites.reviewScoring.update(
    { site: site.type, expectedVersion: 0, policy },
    { context: { user } },
  );
  expect(result.recomputePending).toBe(true);
  await routerClient.externalSites.reviewScoring.update(
    { site: site.type, expectedVersion: 1, policy },
    { context: { user } },
  );
  await updateSiteReviewScores({ siteId: site.id });
  expect(
    (await loadReviewScoringSettings([site.id])).get(site.id),
  ).toMatchObject({ version: 2, recomputePending: false });
});
