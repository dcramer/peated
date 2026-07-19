import { getUserActor } from "@peated/server/lib/actors";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { and, asc, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { db } from "../db";
import { getPostgresConnectionConfig } from "../db/connection";
import {
  bottleReleasePromotions,
  catalogTargets,
  collectionBottles,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "../db/schema";
import { backfillLegacyCatalogParent } from "./catalogMigrationBackfill";
import {
  backfillLegacyCatalogConsumersForParent,
  CATALOG_MIGRATION_CONSUMER_SLOTS,
  CatalogMigrationConsumerBackfillError,
} from "./catalogMigrationConsumerBackfill";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

type ConsumerSetIds = {
  tastingId: number;
  reviewId: number;
  collectionBottleId: number;
  flightId: number;
  storePriceId: number;
  decisionId: number;
  currentProposalId: number;
  suggestedProposalId: number;
  currentAttemptId: number;
  suggestedAttemptId: number;
};

async function exactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error(`Missing exact target for Bottle ${bottleId}.`);
  return target.id;
}

async function genericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error(`Missing generic target for group ${groupId}.`);
  return target.id;
}

async function createLegacyRelease(
  fixtures: typeof Fixtures,
  bottleId: number,
  label: string,
) {
  return await fixtures.BottleRelease({
    bottleId,
    edition: label,
    name: `${label} release`,
  });
}

async function insertStorePrice({
  label,
  externalSiteId,
  bottleId,
  releaseId,
  targetId,
}: {
  label: string;
  externalSiteId: number;
  bottleId: number | null;
  releaseId: number | null;
  targetId: number | null;
}) {
  const [row] = await db
    .insert(storePrices)
    .values({
      externalSiteId,
      name: `${label} store price`,
      imageUrl: `https://example.test/${label}/image.jpg`,
      bottleId,
      releaseId,
      targetId,
      hidden: false,
      price: 12_345,
      currency: "usd",
      volume: 750,
      url: `https://example.test/${label}/price`,
      createdAt: new Date("2020-01-02T03:04:05.000Z"),
      updatedAt: new Date("2021-02-03T04:05:06.000Z"),
    })
    .returning();
  if (!row) throw new Error("Unable to create StorePrice test row.");
  return row;
}

async function createConsumerSet({
  fixtures,
  label,
  bottleId,
  releaseId,
  targetId = null,
}: {
  fixtures: typeof Fixtures;
  label: string;
  bottleId: number;
  releaseId: number | null;
  targetId?: number | null;
}): Promise<ConsumerSetIds> {
  const user = await fixtures.User();
  const actor = await getUserActor(user);
  const externalSite = await fixtures.ExternalSite();
  const collection = await fixtures.Collection({
    name: `${label} collection`,
    createdById: user.id,
  });
  const flight = await fixtures.Flight({
    name: `${label} flight`,
    createdById: user.id,
  });
  const createdAt = new Date("2022-03-04T05:06:07.000Z");
  const updatedAt = new Date("2023-04-05T06:07:08.000Z");

  const [tasting] = await db
    .insert(tastings)
    .values({
      bottleId,
      releaseId,
      targetId,
      tags: ["smoke", "fruit"],
      color: 8,
      rating: 4,
      imageUrl: `https://example.test/${label}/tasting.jpg`,
      notes: `${label} tasting notes`,
      servingStyle: "neat",
      friends: [user.id],
      comments: 2,
      toasts: 3,
      createdAt,
      createdById: user.id,
    })
    .returning();
  const [review] = await db
    .insert(reviews)
    .values({
      externalSiteId: externalSite.id,
      name: `${label} review`,
      bottleId,
      releaseId,
      targetId,
      hidden: false,
      rating: 91,
      issue: `${label} issue`,
      url: `https://example.test/${label}/review`,
      createdAt,
      updatedAt,
    })
    .returning();
  const [collectionBottle] = await db
    .insert(collectionBottles)
    .values({
      collectionId: collection.id,
      bottleId,
      releaseId,
      targetId,
      imageUrl: `https://example.test/${label}/collection.jpg`,
      status: "open",
      createdAt,
    })
    .returning();
  const [flightBottle] = await db
    .insert(flightBottles)
    .values({
      flightId: flight.id,
      bottleId,
      releaseId,
      targetId,
    })
    .returning();
  const price = await insertStorePrice({
    label,
    externalSiteId: externalSite.id,
    bottleId,
    releaseId,
    targetId,
  });
  const [decision] = await db
    .insert(incomingBottleDecisionLogs)
    .values({
      sourceKind: "store_price",
      sourceId: price.id,
      externalSiteId: externalSite.id,
      name: `${label} decision`,
      url: price.url,
      decision: "match_existing",
      actorId: actor.id,
      bottleId,
      releaseId,
      targetId,
      createdBottle: false,
      createdRelease: releaseId !== null,
      confidence: 87,
      model: "retained-test-model",
      rationale: `${label} retained rationale`,
      metadata: { label, retained: true },
      createdAt,
    })
    .returning();

  const suggestedPrice = await insertStorePrice({
    label: `${label}-suggested`,
    externalSiteId: externalSite.id,
    bottleId: null,
    releaseId: null,
    targetId: null,
  });
  const [currentProposal] = await db
    .insert(storePriceMatchProposals)
    .values({
      priceId: price.id,
      status: "approved",
      proposalType: "match_existing",
      confidence: 82,
      currentBottleId: bottleId,
      currentReleaseId: releaseId,
      currentTargetId: targetId,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      suggestedTargetId: null,
      aliasScope: "global_alias",
      candidateBottles: [{ bottleId, label }],
      searchEvidence: [{ source: label }],
      rationale: `${label} current proposal rationale`,
      model: "retained-test-model",
      reviewedById: user.id,
      reviewedAt: updatedAt,
      createdAt,
      updatedAt,
    })
    .returning();
  const [suggestedProposal] = await db
    .insert(storePriceMatchProposals)
    .values({
      priceId: suggestedPrice.id,
      status: "pending_review",
      proposalType: "match_existing",
      confidence: 76,
      currentBottleId: null,
      currentReleaseId: null,
      currentTargetId: null,
      suggestedBottleId: bottleId,
      suggestedReleaseId: releaseId,
      suggestedTargetId: targetId,
      aliasScope: "none",
      candidateBottles: [{ bottleId, suggested: true }],
      searchEvidence: [{ source: `${label}-suggested` }],
      rationale: `${label} suggested proposal rationale`,
      model: "retained-test-model",
      createdAt,
      updatedAt,
    })
    .returning();
  if (
    !tasting ||
    !review ||
    !collectionBottle ||
    !flightBottle ||
    !decision ||
    !currentProposal ||
    !suggestedProposal
  ) {
    throw new Error("Unable to create consumer test rows.");
  }

  const [currentAttempt] = await db
    .insert(storePriceMatchAttempts)
    .values({
      priceId: price.id,
      proposalId: currentProposal.id,
      proposalType: "match_existing",
      initialStatus: "pending_review",
      finalStatus: "approved",
      confidence: 79,
      currentBottleId: bottleId,
      currentReleaseId: releaseId,
      currentTargetId: targetId,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      suggestedTargetId: null,
      automationEligible: true,
      automationScore: 77,
      model: "retained-test-model",
      reviewedById: user.id,
      reviewedAt: updatedAt,
      createdAt,
      updatedAt,
    })
    .returning();
  const [suggestedAttempt] = await db
    .insert(storePriceMatchAttempts)
    .values({
      priceId: suggestedPrice.id,
      proposalId: suggestedProposal.id,
      proposalType: "match_existing",
      initialStatus: "pending_review",
      confidence: 71,
      currentBottleId: null,
      currentReleaseId: null,
      currentTargetId: null,
      suggestedBottleId: bottleId,
      suggestedReleaseId: releaseId,
      suggestedTargetId: targetId,
      automationEligible: false,
      model: "retained-test-model",
      createdAt,
      updatedAt,
    })
    .returning();
  if (!currentAttempt || !suggestedAttempt) {
    throw new Error("Unable to create proposal-attempt test rows.");
  }

  return {
    tastingId: tasting.id,
    reviewId: review.id,
    collectionBottleId: collectionBottle.id,
    flightId: flight.id,
    storePriceId: price.id,
    decisionId: decision.id,
    currentProposalId: currentProposal.id,
    suggestedProposalId: suggestedProposal.id,
    currentAttemptId: currentAttempt.id,
    suggestedAttemptId: suggestedAttempt.id,
  };
}

async function loadConsumerSet(ids: ConsumerSetIds) {
  const [
    tasting,
    review,
    collectionBottle,
    flightBottle,
    storePrice,
    decision,
    currentProposal,
    suggestedProposal,
    currentAttempt,
    suggestedAttempt,
  ] = await Promise.all([
    db.query.tastings.findFirst({ where: eq(tastings.id, ids.tastingId) }),
    db.query.reviews.findFirst({ where: eq(reviews.id, ids.reviewId) }),
    db.query.collectionBottles.findFirst({
      where: eq(collectionBottles.id, ids.collectionBottleId),
    }),
    db.query.flightBottles.findFirst({
      where: eq(flightBottles.flightId, ids.flightId),
    }),
    db.query.storePrices.findFirst({
      where: eq(storePrices.id, ids.storePriceId),
    }),
    db.query.incomingBottleDecisionLogs.findFirst({
      where: eq(incomingBottleDecisionLogs.id, ids.decisionId),
    }),
    db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, ids.currentProposalId),
    }),
    db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, ids.suggestedProposalId),
    }),
    db.query.storePriceMatchAttempts.findFirst({
      where: eq(storePriceMatchAttempts.id, ids.currentAttemptId),
    }),
    db.query.storePriceMatchAttempts.findFirst({
      where: eq(storePriceMatchAttempts.id, ids.suggestedAttemptId),
    }),
  ]);
  if (
    !tasting ||
    !review ||
    !collectionBottle ||
    !flightBottle ||
    !storePrice ||
    !decision ||
    !currentProposal ||
    !suggestedProposal ||
    !currentAttempt ||
    !suggestedAttempt
  ) {
    throw new Error("Unable to reload consumer test rows.");
  }
  return {
    tasting,
    review,
    collectionBottle,
    flightBottle,
    storePrice,
    decision,
    currentProposal,
    suggestedProposal,
    currentAttempt,
    suggestedAttempt,
  };
}

function withTarget(
  rows: Awaited<ReturnType<typeof loadConsumerSet>>,
  targetId: number,
) {
  return {
    tasting: { ...rows.tasting, targetId },
    review: { ...rows.review, targetId },
    collectionBottle: { ...rows.collectionBottle, targetId },
    flightBottle: { ...rows.flightBottle, targetId },
    storePrice: { ...rows.storePrice, targetId },
    decision: { ...rows.decision, targetId },
    currentProposal: { ...rows.currentProposal, currentTargetId: targetId },
    suggestedProposal: {
      ...rows.suggestedProposal,
      suggestedTargetId: targetId,
    },
    currentAttempt: { ...rows.currentAttempt, currentTargetId: targetId },
    suggestedAttempt: {
      ...rows.suggestedAttempt,
      suggestedTargetId: targetId,
    },
  };
}

async function expectBackfillError(
  promise: Promise<unknown>,
  expected: Partial<CatalogMigrationConsumerBackfillError>,
) {
  const error = await waitError(promise);
  expect(error).toBeInstanceOf(CatalogMigrationConsumerBackfillError);
  expect(error).toMatchObject(expected);
}

async function waitForSessionBlockedBy(
  observer: NodePgClient,
  blockerPid: number,
): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))
       ORDER BY pid
       LIMIT 1`,
      [blockerPid],
    );
    const blockedPid = result.rows[0]?.pid;
    if (blockedPid) return blockedPid;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for catalog consumer backfill lock.");
}

async function expectNowaitLockFailure(
  client: NodePgClient,
  query: string,
  values: unknown[],
) {
  await client.query("BEGIN");
  try {
    await expect(client.query(query, values)).rejects.toMatchObject({
      code: "55P03",
    });
  } finally {
    await client.query("ROLLBACK");
  }
}

describe("legacy catalog consumer backfill", () => {
  test("maps every split-family consumer slot and preserves all retained data", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "split-family",
    );
    const exactRows = await createConsumerSet({
      fixtures,
      label: "split-exact",
      bottleId: parent.id,
      releaseId: release.id,
    });
    const genericRows = await createConsumerSet({
      fixtures,
      label: "split-generic",
      bottleId: parent.id,
      releaseId: null,
    });
    const exactBefore = await loadConsumerSet(exactRows);
    const genericBefore = await loadConsumerSet(genericRows);
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const exactTarget = promotion.promoted[0]!.targetId;
    const genericTarget = await genericTargetId(promotion.groupId);

    const first = await backfillLegacyCatalogConsumersForParent(parent.id);

    expect(first.totals).toEqual({ rows: 20, updated: 20, reused: 0 });
    expect(first.slots).toEqual(
      Object.fromEntries(
        CATALOG_MIGRATION_CONSUMER_SLOTS.map((surface) => [
          surface,
          { rows: 2, updated: 2, reused: 0 },
        ]),
      ),
    );

    expect(await loadConsumerSet(exactRows)).toEqual(
      withTarget(exactBefore, exactTarget),
    );
    expect(await loadConsumerSet(genericRows)).toEqual(
      withTarget(genericBefore, genericTarget),
    );

    const afterFirstRun = {
      exact: await loadConsumerSet(exactRows),
      generic: await loadConsumerSet(genericRows),
    };
    const rerun = await backfillLegacyCatalogConsumersForParent(parent.id);
    expect(rerun.totals).toEqual({ rows: 20, updated: 0, reused: 20 });
    expect({
      exact: await loadConsumerSet(exactRows),
      generic: await loadConsumerSet(genericRows),
    }).toEqual(afterFirstRun);
  });

  test("maps every zero-release consumer slot to the retained exact target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const ids = await createConsumerSet({
      fixtures,
      label: "zero-release",
      bottleId: parent.id,
      releaseId: null,
    });
    const before = await loadConsumerSet(ids);
    await backfillLegacyCatalogParent(parent.id);
    const targetId = await exactTargetId(parent.id);

    const result = await backfillLegacyCatalogConsumersForParent(parent.id);

    expect(result.totals).toEqual({ rows: 10, updated: 10, reused: 0 });
    expect(await loadConsumerSet(ids)).toEqual(withTarget(before, targetId));
  });

  test("preserves an existing target on an opposite null-null projection", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "mixed-projection",
    );
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const targetId = promotion.promoted[0]!.targetId;
    const otherBottle = await fixtures.Bottle();
    const otherTargetId = await exactTargetId(otherBottle.id);
    const externalSite = await fixtures.ExternalSite();
    const price = await insertStorePrice({
      label: "mixed-projection-family",
      externalSiteId: externalSite.id,
      bottleId: null,
      releaseId: null,
      targetId: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        confidence: 88,
        currentBottleId: parent.id,
        currentReleaseId: release.id,
        currentTargetId: null,
        suggestedBottleId: null,
        suggestedReleaseId: null,
        suggestedTargetId: otherTargetId,
        candidateBottles: [
          { bottleId: parent.id, releaseId: release.id },
          { bottleId: otherBottle.id, targetId: otherTargetId },
        ],
        rationale: "Retain the unrelated suggested identity",
        model: "retained-test-model",
      })
      .returning();
    if (!proposal) throw new Error("Unable to create mixed proposal.");
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        confidence: 83,
        currentBottleId: null,
        currentReleaseId: null,
        currentTargetId: otherTargetId,
        suggestedBottleId: parent.id,
        suggestedReleaseId: release.id,
        suggestedTargetId: null,
        automationEligible: true,
        automationScore: 81,
        model: "retained-test-model",
      })
      .returning();
    if (!attempt) throw new Error("Unable to create mixed attempt.");

    const result = await backfillLegacyCatalogConsumersForParent(parent.id);

    expect(result.totals).toEqual({ rows: 2, updated: 2, reused: 0 });
    expect(result.slots["store_price_match_proposal.current"]).toEqual({
      rows: 1,
      updated: 1,
      reused: 0,
    });
    expect(result.slots["store_price_match_proposal.suggested"]).toEqual({
      rows: 0,
      updated: 0,
      reused: 0,
    });
    expect(result.slots["store_price_match_attempt.current"]).toEqual({
      rows: 0,
      updated: 0,
      reused: 0,
    });
    expect(result.slots["store_price_match_attempt.suggested"]).toEqual({
      rows: 1,
      updated: 1,
      reused: 0,
    });
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
    ).toEqual({ ...proposal, currentTargetId: targetId });
    expect(
      await db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt.id),
      }),
    ).toEqual({ ...attempt, suggestedTargetId: targetId });
  });

  test("rolls back the family when a later consumer slot has a conflicting target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "target-conflict",
    );
    const ids = await createConsumerSet({
      fixtures,
      label: "target-conflict",
      bottleId: parent.id,
      releaseId: release.id,
    });
    await backfillLegacyCatalogParent(parent.id);
    const otherBottle = await fixtures.Bottle();
    const otherTargetId = await exactTargetId(otherBottle.id);
    await db
      .update(storePriceMatchAttempts)
      .set({ suggestedTargetId: otherTargetId })
      .where(eq(storePriceMatchAttempts.id, ids.suggestedAttemptId));
    const before = await loadConsumerSet(ids);

    await expectBackfillError(
      backfillLegacyCatalogConsumersForParent(parent.id),
      {
        code: "target_conflict",
        surface: "store_price_match_attempt",
        rowId: ids.suggestedAttemptId,
        projection: "suggested",
      },
    );

    expect(await loadConsumerSet(ids)).toEqual(before);
  });

  test("rejects a parent paired with another parent's release", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const otherParent = await fixtures.LegacyBottle();
    const otherRelease = await createLegacyRelease(
      fixtures,
      otherParent.id,
      "foreign-parent",
    );
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: otherRelease.id,
      targetId: null,
    });
    await backfillLegacyCatalogParent(parent.id);

    await expectBackfillError(
      backfillLegacyCatalogConsumersForParent(parent.id),
      { code: "invalid_pair", surface: "review", rowId: review.id },
    );

    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toEqual(review);
  });

  test("rejects a family release retained under another Bottle", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "inverse-invalid",
    );
    const otherParent = await fixtures.LegacyBottle();
    const externalSite = await fixtures.ExternalSite();
    const price = await insertStorePrice({
      label: "inverse-invalid-pair",
      externalSiteId: externalSite.id,
      bottleId: otherParent.id,
      releaseId: release.id,
      targetId: null,
    });
    await backfillLegacyCatalogParent(parent.id);

    await expectBackfillError(
      backfillLegacyCatalogConsumersForParent(parent.id),
      {
        code: "invalid_pair",
        surface: "store_price",
        rowId: price.id,
      },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toEqual(price);
  });

  test("rejects consumer backfill before the parent promotion graph is complete", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "incomplete-graph",
    );
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
    });

    await expectBackfillError(
      backfillLegacyCatalogConsumersForParent(parent.id),
      { code: "target_resolution_failed" },
    );

    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toEqual(review);
    expect(
      await db.query.bottleReleasePromotions.findFirst({
        where: eq(bottleReleasePromotions.releaseId, release.id),
      }),
    ).toBeUndefined();
  });

  test("leaves optional null-null consumer identities untouched", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    await backfillLegacyCatalogParent(parent.id);
    const externalSite = await fixtures.ExternalSite();
    const review = await fixtures.Review({
      externalSiteId: externalSite.id,
      name: "Unassigned retained review",
      bottleId: null,
      releaseId: null,
      targetId: null,
    });
    const price = await insertStorePrice({
      label: "unassigned-consumer",
      externalSiteId: externalSite.id,
      bottleId: null,
      releaseId: null,
      targetId: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "no_match",
        currentBottleId: null,
        currentReleaseId: null,
        currentTargetId: null,
        suggestedBottleId: null,
        suggestedReleaseId: null,
        suggestedTargetId: null,
        rationale: "Retained no-match evidence",
      })
      .returning();
    if (!proposal) throw new Error("Unable to create unassigned proposal.");
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "no_match",
        initialStatus: "pending_review",
        currentBottleId: null,
        currentReleaseId: null,
        currentTargetId: null,
        suggestedBottleId: null,
        suggestedReleaseId: null,
        suggestedTargetId: null,
      })
      .returning();
    if (!attempt) throw new Error("Unable to create unassigned attempt.");

    const result = await backfillLegacyCatalogConsumersForParent(parent.id);

    expect(result.totals).toEqual({ rows: 0, updated: 0, reused: 0 });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toEqual(review);
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toEqual(price);
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
    ).toEqual(proposal);
    expect(
      await db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt.id),
      }),
    ).toEqual(attempt);
  });

  describe.each(["collection_bottle", "flight_bottle", "tasting"] as const)(
    "%s target-membership collision",
    (surface) => {
      test("rejects the collision without changing either row", async ({
        fixtures,
      }) => {
        const parent = await fixtures.LegacyBottle();
        const release = await createLegacyRelease(
          fixtures,
          parent.id,
          `${surface}-collision`,
        );
        const promotion = await backfillLegacyCatalogParent(parent.id);
        const targetId = promotion.promoted[0]!.targetId;
        const otherBottle = await fixtures.Bottle();

        if (surface === "collection_bottle") {
          const collection = await fixtures.Collection();
          const before = await db
            .insert(collectionBottles)
            .values([
              {
                collectionId: collection.id,
                bottleId: parent.id,
                releaseId: release.id,
                targetId: null,
                status: "open",
              },
              {
                collectionId: collection.id,
                bottleId: otherBottle.id,
                releaseId: null,
                targetId,
                status: "sealed",
              },
            ])
            .returning();

          await expectBackfillError(
            backfillLegacyCatalogConsumersForParent(parent.id),
            { code: "membership_conflict", surface },
          );
          expect(
            await db
              .select()
              .from(collectionBottles)
              .where(eq(collectionBottles.collectionId, collection.id))
              .orderBy(asc(collectionBottles.id)),
          ).toEqual(before.sort((left, right) => left.id - right.id));
          return;
        }

        if (surface === "flight_bottle") {
          const flight = await fixtures.Flight();
          const before = await db
            .insert(flightBottles)
            .values([
              {
                flightId: flight.id,
                bottleId: parent.id,
                releaseId: release.id,
                targetId: null,
              },
              {
                flightId: flight.id,
                bottleId: otherBottle.id,
                releaseId: null,
                targetId,
              },
            ])
            .returning();

          await expectBackfillError(
            backfillLegacyCatalogConsumersForParent(parent.id),
            { code: "membership_conflict", surface },
          );
          expect(
            await db
              .select()
              .from(flightBottles)
              .where(eq(flightBottles.flightId, flight.id))
              .orderBy(asc(flightBottles.bottleId)),
          ).toEqual(
            before.sort((left, right) => left.bottleId - right.bottleId),
          );
          return;
        }

        const user = await fixtures.User();
        const createdAt = new Date("2020-01-02T03:04:05.000Z");
        const before = await db
          .insert(tastings)
          .values([
            {
              bottleId: parent.id,
              releaseId: release.id,
              targetId: null,
              rating: 3,
              createdById: user.id,
              createdAt,
            },
            {
              bottleId: otherBottle.id,
              releaseId: null,
              targetId,
              rating: 4,
              createdById: user.id,
              createdAt,
            },
          ])
          .returning();

        await expectBackfillError(
          backfillLegacyCatalogConsumersForParent(parent.id),
          { code: "membership_conflict", surface },
        );
        expect(
          await db
            .select()
            .from(tastings)
            .where(eq(tastings.createdById, user.id))
            .orderBy(asc(tastings.id)),
        ).toEqual(before.sort((left, right) => left.id - right.id));
      });
    },
  );

  test("takes group and Bottle locks before waiting for a CatalogTarget", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "target-lock-order",
    );
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const promoted = promotion.promoted[0]!;
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let backfill: ReturnType<
      typeof backfillLegacyCatalogConsumersForParent
    > | null = null;
    let blockerCommitted = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load blocker pid.");
      await blocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [promoted.targetId],
      );

      backfill = backfillLegacyCatalogConsumersForParent(parent.id);
      void backfill.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle_group WHERE id = $1 FOR UPDATE NOWAIT",
        [promotion.groupId],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle WHERE id = $1 FOR UPDATE NOWAIT",
        [parent.id],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle WHERE id = $1 FOR UPDATE NOWAIT",
        [promoted.bottleId],
      );

      await blocker.query("COMMIT");
      blockerCommitted = true;
      await expect(backfill).resolves.toMatchObject({ parentId: parent.id });
    } finally {
      if (!blockerCommitted) await blocker.query("ROLLBACK").catch(() => {});
      if (backfill) await backfill.catch(() => undefined);
      await blocker.end();
      await observer.end();
    }
  });

  test("locks release and promotion evidence before waiting for a consumer", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "evidence-lock-order",
    );
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
    });
    await backfillLegacyCatalogParent(parent.id);
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let backfill: ReturnType<
      typeof backfillLegacyCatalogConsumersForParent
    > | null = null;
    let blockerCommitted = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load blocker pid.");
      await blocker.query("SELECT id FROM review WHERE id = $1 FOR UPDATE", [
        review.id,
      ]);

      backfill = backfillLegacyCatalogConsumersForParent(parent.id);
      void backfill.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle_release WHERE id = $1 FOR UPDATE NOWAIT",
        [release.id],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT release_id FROM bottle_release_promotion WHERE release_id = $1 FOR UPDATE NOWAIT",
        [release.id],
      );

      await blocker.query("COMMIT");
      blockerCommitted = true;
      await expect(backfill).resolves.toMatchObject({ parentId: parent.id });
    } finally {
      if (!blockerCommitted) await blocker.query("ROLLBACK").catch(() => {});
      if (backfill) await backfill.catch(() => undefined);
      await blocker.end();
      await observer.end();
    }
  });

  test("rejects a concurrently cleared target and rolls back earlier consumer writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await createLegacyRelease(
      fixtures,
      parent.id,
      "concurrent-target-clear",
    );
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const targetId = promotion.promoted[0]!.targetId;
    const tasting = await fixtures.Tasting({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
    });
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: release.id,
      targetId,
    });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let backfill: ReturnType<
      typeof backfillLegacyCatalogConsumersForParent
    > | null = null;
    let blockerCommitted = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load blocker pid.");
      await blocker.query("SELECT id FROM review WHERE id = $1 FOR UPDATE", [
        review.id,
      ]);

      backfill = backfillLegacyCatalogConsumersForParent(parent.id);
      void backfill.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);
      await blocker.query("UPDATE review SET target_id = NULL WHERE id = $1", [
        review.id,
      ]);
      await blocker.query("COMMIT");
      blockerCommitted = true;

      await expectBackfillError(backfill, {
        code: "row_changed",
        surface: "review",
        rowId: review.id,
      });
    } finally {
      if (!blockerCommitted) await blocker.query("ROLLBACK").catch(() => {});
      if (backfill) await backfill.catch(() => undefined);
      await blocker.end();
      await observer.end();
    }

    expect(
      await db.query.tastings.findFirst({ where: eq(tastings.id, tasting.id) }),
    ).toEqual(tasting);
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toEqual({ ...review, targetId: null });
  });
});
