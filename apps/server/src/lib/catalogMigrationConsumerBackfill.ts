/**
 * Backfills durable CatalogTargets on retained legacy consumer rows. Each
 * promoted parent family commits as one target-only transaction.
 */
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db, type AnyConnection, type AnyTransaction } from "../db";
import {
  collectionBottles,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "../db/schema";
import {
  CatalogMigrationFamilyTargetError,
  lockCatalogMigrationFamilyTargetsInTransaction,
} from "./catalogMigrationFamilyTargets";
import type { CatalogTargetAssignmentDescriptor } from "./catalogTargets";

export type CatalogMigrationConsumerSurface =
  | "tasting"
  | "review"
  | "collection_bottle"
  | "flight_bottle"
  | "store_price"
  | "incoming_bottle_decision_log"
  | "store_price_match_proposal"
  | "store_price_match_attempt";

export type CatalogMigrationConsumerProjection = "current" | "suggested" | null;

export type CatalogMigrationConsumerBackfillErrorCode =
  | "parent_not_found"
  | "target_resolution_failed"
  | "target_graph_changed"
  | "invalid_pair"
  | "target_conflict"
  | "row_changed"
  | "membership_conflict";

export class CatalogMigrationConsumerBackfillError extends Error {
  constructor(
    readonly code: CatalogMigrationConsumerBackfillErrorCode,
    readonly parentId: number,
    readonly surface: CatalogMigrationConsumerSurface | null,
    readonly rowId: string | number | null,
    readonly projection: CatalogMigrationConsumerProjection,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(
      `Catalog migration consumer ${code} for parent ${parentId}${surface && rowId !== null ? ` ${surface} ${rowId}` : ""}${projection ? ` ${projection}` : ""}.`,
      options,
    );
    this.name = "CatalogMigrationConsumerBackfillError";
  }
}

export type CatalogMigrationConsumerBackfillCounts = {
  rows: number;
  updated: number;
  reused: number;
};

export const CATALOG_MIGRATION_CONSUMER_SLOTS = [
  "tasting",
  "review",
  "collection_bottle",
  "flight_bottle",
  "store_price",
  "incoming_bottle_decision_log",
  "store_price_match_proposal.current",
  "store_price_match_proposal.suggested",
  "store_price_match_attempt.current",
  "store_price_match_attempt.suggested",
] as const;

export type CatalogMigrationConsumerSlot =
  (typeof CATALOG_MIGRATION_CONSUMER_SLOTS)[number];

export type CatalogMigrationConsumerBackfillResult = {
  parentId: number;
  slots: Record<
    CatalogMigrationConsumerSlot,
    CatalogMigrationConsumerBackfillCounts
  >;
  totals: CatalogMigrationConsumerBackfillCounts;
};

type IdentitySnapshot = {
  bottleId: number | null;
  releaseId: number | null;
  targetId: number | null;
};

type PlannedIdentity = IdentitySnapshot & {
  expectedTargetId: number;
};

type RowPlan<Row> = {
  row: Row;
  identity: PlannedIdentity;
};

type PlanContext = {
  parentId: number;
  releaseIds: number[];
  targetByReleaseId: ReadonlyMap<
    number | null,
    CatalogTargetAssignmentDescriptor
  >;
};

function consumerError(
  code: CatalogMigrationConsumerBackfillErrorCode,
  context: PlanContext,
  surface: CatalogMigrationConsumerSurface,
  rowId: string | number,
  projection: CatalogMigrationConsumerProjection,
  details: Record<string, unknown>,
): CatalogMigrationConsumerBackfillError {
  return new CatalogMigrationConsumerBackfillError(
    code,
    context.parentId,
    surface,
    rowId,
    projection,
    details,
  );
}

function planIdentity(
  context: PlanContext,
  surface: CatalogMigrationConsumerSurface,
  rowId: string | number,
  projection: CatalogMigrationConsumerProjection,
  snapshot: IdentitySnapshot,
): PlannedIdentity {
  const { bottleId, releaseId, targetId } = snapshot;
  if (
    bottleId !== context.parentId ||
    (releaseId !== null && !context.releaseIds.includes(releaseId))
  ) {
    throw consumerError("invalid_pair", context, surface, rowId, projection, {
      actualBottleId: bottleId,
      expectedBottleId: context.parentId,
      releaseId,
    });
  }
  const target = context.targetByReleaseId.get(releaseId);
  if (!target) {
    throw consumerError("invalid_pair", context, surface, rowId, projection, {
      reason: "the retained pair has no locked family target",
      releaseId,
    });
  }
  if (targetId !== null && targetId !== target.targetId) {
    throw consumerError(
      "target_conflict",
      context,
      surface,
      rowId,
      projection,
      { actualTargetId: targetId, expectedTargetId: target.targetId },
    );
  }
  return { ...snapshot, expectedTargetId: target.targetId };
}

function planOptionalIdentity(
  context: PlanContext,
  surface: "store_price_match_proposal" | "store_price_match_attempt",
  rowId: number,
  projection: Exclude<CatalogMigrationConsumerProjection, null>,
  snapshot: IdentitySnapshot,
): PlannedIdentity | null {
  const participates =
    snapshot.bottleId === context.parentId ||
    (snapshot.releaseId !== null &&
      context.releaseIds.includes(snapshot.releaseId));
  return participates
    ? planIdentity(context, surface, rowId, projection, snapshot)
    : null;
}

function countPlans<Row>(
  plans: RowPlan<Row>[],
): CatalogMigrationConsumerBackfillCounts {
  const reused = plans.filter(
    ({ identity }) => identity.targetId === identity.expectedTargetId,
  ).length;
  return { rows: plans.length, updated: plans.length - reused, reused };
}

async function loadTastingPlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      id: tastings.id,
      bottleId: tastings.bottleId,
      releaseId: tastings.releaseId,
      targetId: tastings.targetId,
      createdById: tastings.createdById,
      createdAt: tastings.createdAt,
    })
    .from(tastings)
    .where(
      context.releaseIds.length
        ? or(
            eq(tastings.bottleId, context.parentId),
            inArray(tastings.releaseId, context.releaseIds),
          )
        : eq(tastings.bottleId, context.parentId),
    )
    .orderBy(asc(tastings.id));
  return rows.map((row) => ({
    row,
    identity: planIdentity(context, "tasting", row.id, null, row),
  }));
}

async function loadReviewPlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      id: reviews.id,
      bottleId: reviews.bottleId,
      releaseId: reviews.releaseId,
      targetId: reviews.targetId,
    })
    .from(reviews)
    .where(
      context.releaseIds.length
        ? or(
            eq(reviews.bottleId, context.parentId),
            inArray(reviews.releaseId, context.releaseIds),
          )
        : eq(reviews.bottleId, context.parentId),
    )
    .orderBy(asc(reviews.id));
  return rows.map((row) => ({
    row,
    identity: planIdentity(context, "review", row.id, null, row),
  }));
}

async function loadCollectionPlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      id: collectionBottles.id,
      collectionId: collectionBottles.collectionId,
      bottleId: collectionBottles.bottleId,
      releaseId: collectionBottles.releaseId,
      targetId: collectionBottles.targetId,
    })
    .from(collectionBottles)
    .where(
      context.releaseIds.length
        ? or(
            eq(collectionBottles.bottleId, context.parentId),
            inArray(collectionBottles.releaseId, context.releaseIds),
          )
        : eq(collectionBottles.bottleId, context.parentId),
    )
    .orderBy(asc(collectionBottles.collectionId), asc(collectionBottles.id));
  return rows.map((row) => ({
    row,
    identity: planIdentity(context, "collection_bottle", row.id, null, row),
  }));
}

async function loadFlightPlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      flightId: flightBottles.flightId,
      bottleId: flightBottles.bottleId,
      releaseId: flightBottles.releaseId,
      targetId: flightBottles.targetId,
    })
    .from(flightBottles)
    .where(
      context.releaseIds.length
        ? or(
            eq(flightBottles.bottleId, context.parentId),
            inArray(flightBottles.releaseId, context.releaseIds),
          )
        : eq(flightBottles.bottleId, context.parentId),
    )
    .orderBy(
      asc(flightBottles.flightId),
      asc(flightBottles.bottleId),
      asc(flightBottles.releaseId),
    );
  return rows.map((row) => {
    const rowId = `${row.flightId}:${row.bottleId}:${row.releaseId ?? "null"}`;
    return {
      row,
      identity: planIdentity(context, "flight_bottle", rowId, null, row),
    };
  });
}

async function loadStorePricePlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      id: storePrices.id,
      bottleId: storePrices.bottleId,
      releaseId: storePrices.releaseId,
      targetId: storePrices.targetId,
    })
    .from(storePrices)
    .where(
      context.releaseIds.length
        ? or(
            eq(storePrices.bottleId, context.parentId),
            inArray(storePrices.releaseId, context.releaseIds),
          )
        : eq(storePrices.bottleId, context.parentId),
    )
    .orderBy(asc(storePrices.id));
  return rows.map((row) => ({
    row,
    identity: planIdentity(context, "store_price", row.id, null, row),
  }));
}

async function loadDecisionPlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      id: incomingBottleDecisionLogs.id,
      bottleId: incomingBottleDecisionLogs.bottleId,
      releaseId: incomingBottleDecisionLogs.releaseId,
      targetId: incomingBottleDecisionLogs.targetId,
    })
    .from(incomingBottleDecisionLogs)
    .where(
      context.releaseIds.length
        ? or(
            eq(incomingBottleDecisionLogs.bottleId, context.parentId),
            inArray(incomingBottleDecisionLogs.releaseId, context.releaseIds),
          )
        : eq(incomingBottleDecisionLogs.bottleId, context.parentId),
    )
    .orderBy(asc(incomingBottleDecisionLogs.id));
  return rows.map((row) => ({
    row,
    identity: planIdentity(
      context,
      "incoming_bottle_decision_log",
      row.id,
      null,
      row,
    ),
  }));
}

async function loadProposalPlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      id: storePriceMatchProposals.id,
      currentBottleId: storePriceMatchProposals.currentBottleId,
      currentReleaseId: storePriceMatchProposals.currentReleaseId,
      currentTargetId: storePriceMatchProposals.currentTargetId,
      suggestedBottleId: storePriceMatchProposals.suggestedBottleId,
      suggestedReleaseId: storePriceMatchProposals.suggestedReleaseId,
      suggestedTargetId: storePriceMatchProposals.suggestedTargetId,
    })
    .from(storePriceMatchProposals)
    .where(
      context.releaseIds.length
        ? or(
            eq(storePriceMatchProposals.currentBottleId, context.parentId),
            inArray(
              storePriceMatchProposals.currentReleaseId,
              context.releaseIds,
            ),
            eq(storePriceMatchProposals.suggestedBottleId, context.parentId),
            inArray(
              storePriceMatchProposals.suggestedReleaseId,
              context.releaseIds,
            ),
          )
        : or(
            eq(storePriceMatchProposals.currentBottleId, context.parentId),
            eq(storePriceMatchProposals.suggestedBottleId, context.parentId),
          ),
    )
    .orderBy(asc(storePriceMatchProposals.id));
  const current: Array<
    RowPlan<{
      id: number;
      currentBottleId: number | null;
      currentReleaseId: number | null;
      currentTargetId: number | null;
    }>
  > = [];
  const suggested: Array<
    RowPlan<{
      id: number;
      suggestedBottleId: number | null;
      suggestedReleaseId: number | null;
      suggestedTargetId: number | null;
    }>
  > = [];
  for (const row of rows) {
    const currentIdentity = planOptionalIdentity(
      context,
      "store_price_match_proposal",
      row.id,
      "current",
      {
        bottleId: row.currentBottleId,
        releaseId: row.currentReleaseId,
        targetId: row.currentTargetId,
      },
    );
    if (currentIdentity) current.push({ row, identity: currentIdentity });
    const suggestedIdentity = planOptionalIdentity(
      context,
      "store_price_match_proposal",
      row.id,
      "suggested",
      {
        bottleId: row.suggestedBottleId,
        releaseId: row.suggestedReleaseId,
        targetId: row.suggestedTargetId,
      },
    );
    if (suggestedIdentity) suggested.push({ row, identity: suggestedIdentity });
  }
  return { rows, current, suggested };
}

async function loadAttemptPlans(tx: AnyTransaction, context: PlanContext) {
  const rows = await tx
    .select({
      id: storePriceMatchAttempts.id,
      currentBottleId: storePriceMatchAttempts.currentBottleId,
      currentReleaseId: storePriceMatchAttempts.currentReleaseId,
      currentTargetId: storePriceMatchAttempts.currentTargetId,
      suggestedBottleId: storePriceMatchAttempts.suggestedBottleId,
      suggestedReleaseId: storePriceMatchAttempts.suggestedReleaseId,
      suggestedTargetId: storePriceMatchAttempts.suggestedTargetId,
    })
    .from(storePriceMatchAttempts)
    .where(
      context.releaseIds.length
        ? or(
            eq(storePriceMatchAttempts.currentBottleId, context.parentId),
            inArray(
              storePriceMatchAttempts.currentReleaseId,
              context.releaseIds,
            ),
            eq(storePriceMatchAttempts.suggestedBottleId, context.parentId),
            inArray(
              storePriceMatchAttempts.suggestedReleaseId,
              context.releaseIds,
            ),
          )
        : or(
            eq(storePriceMatchAttempts.currentBottleId, context.parentId),
            eq(storePriceMatchAttempts.suggestedBottleId, context.parentId),
          ),
    )
    .orderBy(asc(storePriceMatchAttempts.id));
  const current: Array<
    RowPlan<{
      id: number;
      currentBottleId: number | null;
      currentReleaseId: number | null;
      currentTargetId: number | null;
    }>
  > = [];
  const suggested: Array<
    RowPlan<{
      id: number;
      suggestedBottleId: number | null;
      suggestedReleaseId: number | null;
      suggestedTargetId: number | null;
    }>
  > = [];
  for (const row of rows) {
    const currentIdentity = planOptionalIdentity(
      context,
      "store_price_match_attempt",
      row.id,
      "current",
      {
        bottleId: row.currentBottleId,
        releaseId: row.currentReleaseId,
        targetId: row.currentTargetId,
      },
    );
    if (currentIdentity) current.push({ row, identity: currentIdentity });
    const suggestedIdentity = planOptionalIdentity(
      context,
      "store_price_match_attempt",
      row.id,
      "suggested",
      {
        bottleId: row.suggestedBottleId,
        releaseId: row.suggestedReleaseId,
        targetId: row.suggestedTargetId,
      },
    );
    if (suggestedIdentity) suggested.push({ row, identity: suggestedIdentity });
  }
  return { rows, current, suggested };
}

function sameDate(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

async function lockAndValidateDirectRows(
  tx: AnyTransaction,
  context: PlanContext,
  plans: {
    tastings: Awaited<ReturnType<typeof loadTastingPlans>>;
    reviews: Awaited<ReturnType<typeof loadReviewPlans>>;
    collections: Awaited<ReturnType<typeof loadCollectionPlans>>;
    flights: Awaited<ReturnType<typeof loadFlightPlans>>;
    prices: Awaited<ReturnType<typeof loadStorePricePlans>>;
    decisions: Awaited<ReturnType<typeof loadDecisionPlans>>;
  },
): Promise<void> {
  if (plans.tastings.length) {
    const locked = await tx
      .select({
        id: tastings.id,
        bottleId: tastings.bottleId,
        releaseId: tastings.releaseId,
        targetId: tastings.targetId,
        createdById: tastings.createdById,
        createdAt: tastings.createdAt,
      })
      .from(tastings)
      .where(
        inArray(
          tastings.id,
          plans.tastings.map(({ row }) => row.id),
        ),
      )
      .orderBy(asc(tastings.id))
      .for("update");
    for (const [index, plan] of plans.tastings.entries()) {
      const actual = locked[index];
      if (
        !actual ||
        actual.id !== plan.row.id ||
        actual.bottleId !== plan.row.bottleId ||
        actual.releaseId !== plan.row.releaseId ||
        actual.targetId !== plan.row.targetId ||
        actual.createdById !== plan.row.createdById ||
        !sameDate(actual.createdAt, plan.row.createdAt)
      ) {
        throw consumerError(
          "row_changed",
          context,
          "tasting",
          plan.row.id,
          null,
          {
            expected: plan.row,
            actual: actual ?? null,
          },
        );
      }
    }
  }
  if (plans.reviews.length) {
    const locked = await tx
      .select({
        id: reviews.id,
        bottleId: reviews.bottleId,
        releaseId: reviews.releaseId,
        targetId: reviews.targetId,
      })
      .from(reviews)
      .where(
        inArray(
          reviews.id,
          plans.reviews.map(({ row }) => row.id),
        ),
      )
      .orderBy(asc(reviews.id))
      .for("update");
    for (const [index, plan] of plans.reviews.entries()) {
      const actual = locked[index];
      if (
        !actual ||
        actual.id !== plan.row.id ||
        actual.bottleId !== plan.row.bottleId ||
        actual.releaseId !== plan.row.releaseId ||
        actual.targetId !== plan.row.targetId
      ) {
        throw consumerError(
          "row_changed",
          context,
          "review",
          plan.row.id,
          null,
          {
            expected: plan.row,
            actual: actual ?? null,
          },
        );
      }
    }
  }
  if (plans.collections.length) {
    const locked = await tx
      .select({
        id: collectionBottles.id,
        collectionId: collectionBottles.collectionId,
        bottleId: collectionBottles.bottleId,
        releaseId: collectionBottles.releaseId,
        targetId: collectionBottles.targetId,
      })
      .from(collectionBottles)
      .where(
        inArray(
          collectionBottles.id,
          plans.collections.map(({ row }) => row.id),
        ),
      )
      .orderBy(asc(collectionBottles.collectionId), asc(collectionBottles.id))
      .for("update");
    for (const [index, plan] of plans.collections.entries()) {
      const actual = locked[index];
      if (
        !actual ||
        actual.id !== plan.row.id ||
        actual.collectionId !== plan.row.collectionId ||
        actual.bottleId !== plan.row.bottleId ||
        actual.releaseId !== plan.row.releaseId ||
        actual.targetId !== plan.row.targetId
      ) {
        throw consumerError(
          "row_changed",
          context,
          "collection_bottle",
          plan.row.id,
          null,
          { expected: plan.row, actual: actual ?? null },
        );
      }
    }
  }
  if (plans.flights.length) {
    for (const plan of plans.flights) {
      const [actual] = await tx
        .select({
          flightId: flightBottles.flightId,
          bottleId: flightBottles.bottleId,
          releaseId: flightBottles.releaseId,
          targetId: flightBottles.targetId,
        })
        .from(flightBottles)
        .where(
          and(
            eq(flightBottles.flightId, plan.row.flightId),
            eq(flightBottles.bottleId, plan.row.bottleId),
            plan.row.releaseId === null
              ? isNull(flightBottles.releaseId)
              : eq(flightBottles.releaseId, plan.row.releaseId),
          ),
        )
        .limit(1)
        .for("update");
      if (!actual || actual.targetId !== plan.row.targetId) {
        const rowId = `${plan.row.flightId}:${plan.row.bottleId}:${plan.row.releaseId ?? "null"}`;
        throw consumerError(
          "row_changed",
          context,
          "flight_bottle",
          rowId,
          null,
          {
            expected: plan.row,
            actual: actual ?? null,
          },
        );
      }
    }
  }
  for (const [surface, table, tablePlans] of [
    ["store_price", storePrices, plans.prices],
    [
      "incoming_bottle_decision_log",
      incomingBottleDecisionLogs,
      plans.decisions,
    ],
  ] as const) {
    for (const plan of tablePlans) {
      const [actual] = await tx
        .select({
          id: table.id,
          bottleId: table.bottleId,
          releaseId: table.releaseId,
          targetId: table.targetId,
        })
        .from(table)
        .where(eq(table.id, plan.row.id))
        .limit(1)
        .for("update");
      if (
        !actual ||
        actual.bottleId !== plan.row.bottleId ||
        actual.releaseId !== plan.row.releaseId ||
        actual.targetId !== plan.row.targetId
      ) {
        throw consumerError(
          "row_changed",
          context,
          surface,
          plan.row.id,
          null,
          {
            expected: plan.row,
            actual: actual ?? null,
          },
        );
      }
    }
  }
}

async function lockAndValidateDecisionRows(
  tx: AnyTransaction,
  context: PlanContext,
  proposals: Awaited<ReturnType<typeof loadProposalPlans>>,
  attempts: Awaited<ReturnType<typeof loadAttemptPlans>>,
): Promise<void> {
  if (proposals.rows.length) {
    const locked = await tx
      .select({
        id: storePriceMatchProposals.id,
        currentBottleId: storePriceMatchProposals.currentBottleId,
        currentReleaseId: storePriceMatchProposals.currentReleaseId,
        currentTargetId: storePriceMatchProposals.currentTargetId,
        suggestedBottleId: storePriceMatchProposals.suggestedBottleId,
        suggestedReleaseId: storePriceMatchProposals.suggestedReleaseId,
        suggestedTargetId: storePriceMatchProposals.suggestedTargetId,
      })
      .from(storePriceMatchProposals)
      .where(
        inArray(
          storePriceMatchProposals.id,
          proposals.rows.map(({ id }) => id),
        ),
      )
      .orderBy(asc(storePriceMatchProposals.id))
      .for("update");
    for (const [index, expected] of proposals.rows.entries()) {
      const actual = locked[index];
      if (!actual || JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw consumerError(
          "row_changed",
          context,
          "store_price_match_proposal",
          expected.id,
          null,
          { expected, actual: actual ?? null },
        );
      }
    }
  }
  if (attempts.rows.length) {
    const locked = await tx
      .select({
        id: storePriceMatchAttempts.id,
        currentBottleId: storePriceMatchAttempts.currentBottleId,
        currentReleaseId: storePriceMatchAttempts.currentReleaseId,
        currentTargetId: storePriceMatchAttempts.currentTargetId,
        suggestedBottleId: storePriceMatchAttempts.suggestedBottleId,
        suggestedReleaseId: storePriceMatchAttempts.suggestedReleaseId,
        suggestedTargetId: storePriceMatchAttempts.suggestedTargetId,
      })
      .from(storePriceMatchAttempts)
      .where(
        inArray(
          storePriceMatchAttempts.id,
          attempts.rows.map(({ id }) => id),
        ),
      )
      .orderBy(asc(storePriceMatchAttempts.id))
      .for("update");
    for (const [index, expected] of attempts.rows.entries()) {
      const actual = locked[index];
      if (!actual || JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw consumerError(
          "row_changed",
          context,
          "store_price_match_attempt",
          expected.id,
          null,
          { expected, actual: actual ?? null },
        );
      }
    }
  }
}

function assertUniquePlannedMemberships<Row>(
  plans: RowPlan<Row>[],
  keyFor: (plan: RowPlan<Row>) => string,
  context: PlanContext,
  surface: "tasting" | "collection_bottle" | "flight_bottle",
  rowIdFor: (plan: RowPlan<Row>) => string | number,
): void {
  const owners = new Map<string, RowPlan<Row>>();
  for (const plan of plans) {
    const key = keyFor(plan);
    const previous = owners.get(key);
    if (previous) {
      throw consumerError(
        "membership_conflict",
        context,
        surface,
        rowIdFor(plan),
        null,
        {
          expectedTargetId: plan.identity.expectedTargetId,
          conflictingRowId: rowIdFor(previous),
        },
      );
    }
    owners.set(key, plan);
  }
}

async function preflightMembershipConflicts(
  tx: AnyTransaction,
  context: PlanContext,
  tastingPlans: Awaited<ReturnType<typeof loadTastingPlans>>,
  collectionPlans: Awaited<ReturnType<typeof loadCollectionPlans>>,
  flightPlans: Awaited<ReturnType<typeof loadFlightPlans>>,
): Promise<void> {
  assertUniquePlannedMemberships(
    tastingPlans,
    ({ row, identity }) =>
      `${identity.expectedTargetId}:${row.createdById}:${row.createdAt.getTime()}`,
    context,
    "tasting",
    ({ row }) => row.id,
  );
  assertUniquePlannedMemberships(
    collectionPlans,
    ({ row, identity }) => `${row.collectionId}:${identity.expectedTargetId}`,
    context,
    "collection_bottle",
    ({ row }) => row.id,
  );
  assertUniquePlannedMemberships(
    flightPlans,
    ({ row, identity }) => `${row.flightId}:${identity.expectedTargetId}`,
    context,
    "flight_bottle",
    ({ row }) => `${row.flightId}:${row.bottleId}:${row.releaseId ?? "null"}`,
  );

  for (const plan of tastingPlans) {
    const [conflict] = await tx
      .select({ id: tastings.id })
      .from(tastings)
      .where(
        and(
          eq(tastings.targetId, plan.identity.expectedTargetId),
          eq(tastings.createdById, plan.row.createdById),
          eq(tastings.createdAt, plan.row.createdAt),
          ne(tastings.id, plan.row.id),
        ),
      )
      .limit(1)
      .for("update");
    if (conflict) {
      throw consumerError(
        "membership_conflict",
        context,
        "tasting",
        plan.row.id,
        null,
        {
          expectedTargetId: plan.identity.expectedTargetId,
          conflictingRowId: conflict.id,
        },
      );
    }
  }
  for (const plan of collectionPlans) {
    const [conflict] = await tx
      .select({ id: collectionBottles.id })
      .from(collectionBottles)
      .where(
        and(
          eq(collectionBottles.collectionId, plan.row.collectionId),
          eq(collectionBottles.targetId, plan.identity.expectedTargetId),
          ne(collectionBottles.id, plan.row.id),
        ),
      )
      .limit(1)
      .for("update");
    if (conflict) {
      throw consumerError(
        "membership_conflict",
        context,
        "collection_bottle",
        plan.row.id,
        null,
        {
          expectedTargetId: plan.identity.expectedTargetId,
          conflictingRowId: conflict.id,
        },
      );
    }
  }
  for (const plan of flightPlans) {
    const conflicts = await tx
      .select({
        bottleId: flightBottles.bottleId,
        releaseId: flightBottles.releaseId,
      })
      .from(flightBottles)
      .where(
        and(
          eq(flightBottles.flightId, plan.row.flightId),
          eq(flightBottles.targetId, plan.identity.expectedTargetId),
        ),
      )
      .for("update");
    const conflict = conflicts.find(
      (row) =>
        row.bottleId !== plan.row.bottleId ||
        row.releaseId !== plan.row.releaseId,
    );
    if (conflict) {
      throw consumerError(
        "membership_conflict",
        context,
        "flight_bottle",
        `${plan.row.flightId}:${plan.row.bottleId}:${plan.row.releaseId ?? "null"}`,
        null,
        {
          expectedTargetId: plan.identity.expectedTargetId,
          conflictingRowId: `${plan.row.flightId}:${conflict.bottleId}:${conflict.releaseId ?? "null"}`,
        },
      );
    }
  }
}

async function applyDirectPlans(
  tx: AnyTransaction,
  plans: {
    tastings: Awaited<ReturnType<typeof loadTastingPlans>>;
    reviews: Awaited<ReturnType<typeof loadReviewPlans>>;
    collections: Awaited<ReturnType<typeof loadCollectionPlans>>;
    flights: Awaited<ReturnType<typeof loadFlightPlans>>;
    prices: Awaited<ReturnType<typeof loadStorePricePlans>>;
    decisions: Awaited<ReturnType<typeof loadDecisionPlans>>;
  },
): Promise<void> {
  for (const { row, identity } of plans.tastings) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(tastings)
        .set({ targetId: identity.expectedTargetId })
        .where(eq(tastings.id, row.id));
    }
  }
  for (const { row, identity } of plans.reviews) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(reviews)
        .set({ targetId: identity.expectedTargetId })
        .where(eq(reviews.id, row.id));
    }
  }
  for (const { row, identity } of plans.collections) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(collectionBottles)
        .set({ targetId: identity.expectedTargetId })
        .where(eq(collectionBottles.id, row.id));
    }
  }
  for (const { row, identity } of plans.flights) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(flightBottles)
        .set({ targetId: identity.expectedTargetId })
        .where(
          and(
            eq(flightBottles.flightId, row.flightId),
            eq(flightBottles.bottleId, row.bottleId),
            row.releaseId === null
              ? isNull(flightBottles.releaseId)
              : eq(flightBottles.releaseId, row.releaseId),
          ),
        );
    }
  }
  for (const { row, identity } of plans.prices) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(storePrices)
        .set({ targetId: identity.expectedTargetId })
        .where(eq(storePrices.id, row.id));
    }
  }
  for (const { row, identity } of plans.decisions) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(incomingBottleDecisionLogs)
        .set({ targetId: identity.expectedTargetId })
        .where(eq(incomingBottleDecisionLogs.id, row.id));
    }
  }
}

async function applyDecisionPlans(
  tx: AnyTransaction,
  proposals: Awaited<ReturnType<typeof loadProposalPlans>>,
  attempts: Awaited<ReturnType<typeof loadAttemptPlans>>,
): Promise<void> {
  for (const { row, identity } of proposals.current) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(storePriceMatchProposals)
        .set({ currentTargetId: identity.expectedTargetId })
        .where(eq(storePriceMatchProposals.id, row.id));
    }
  }
  for (const { row, identity } of proposals.suggested) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(storePriceMatchProposals)
        .set({ suggestedTargetId: identity.expectedTargetId })
        .where(eq(storePriceMatchProposals.id, row.id));
    }
  }
  for (const { row, identity } of attempts.current) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(storePriceMatchAttempts)
        .set({ currentTargetId: identity.expectedTargetId })
        .where(eq(storePriceMatchAttempts.id, row.id));
    }
  }
  for (const { row, identity } of attempts.suggested) {
    if (identity.targetId !== identity.expectedTargetId) {
      await tx
        .update(storePriceMatchAttempts)
        .set({ suggestedTargetId: identity.expectedTargetId })
        .where(eq(storePriceMatchAttempts.id, row.id));
    }
  }
}

/** Backfills all remaining target-bearing consumers for one promoted family. */
export async function backfillLegacyCatalogConsumersForParent(
  parentId: number,
  database: AnyConnection = db,
): Promise<CatalogMigrationConsumerBackfillResult> {
  return await database.transaction(async (tx) => {
    let family;
    try {
      family = await lockCatalogMigrationFamilyTargetsInTransaction(
        tx,
        parentId,
        { caller: "catalogMigrationConsumerBackfill" },
      );
    } catch (error) {
      if (!(error instanceof CatalogMigrationFamilyTargetError)) throw error;
      throw new CatalogMigrationConsumerBackfillError(
        error.code,
        parentId,
        null,
        null,
        null,
        { ...error.details, releaseId: error.releaseId },
        { cause: error },
      );
    }
    const context: PlanContext = { parentId, ...family };

    const tastingPlans = await loadTastingPlans(tx, context);
    const reviewPlans = await loadReviewPlans(tx, context);
    const collectionPlans = await loadCollectionPlans(tx, context);
    const flightPlans = await loadFlightPlans(tx, context);
    const pricePlans = await loadStorePricePlans(tx, context);
    const decisionPlans = await loadDecisionPlans(tx, context);
    const proposalPlans = await loadProposalPlans(tx, context);
    const attemptPlans = await loadAttemptPlans(tx, context);

    const directPlans = {
      tastings: tastingPlans,
      reviews: reviewPlans,
      collections: collectionPlans,
      flights: flightPlans,
      prices: pricePlans,
      decisions: decisionPlans,
    };
    await lockAndValidateDirectRows(tx, context, directPlans);
    await lockAndValidateDecisionRows(tx, context, proposalPlans, attemptPlans);
    await preflightMembershipConflicts(
      tx,
      context,
      tastingPlans,
      collectionPlans,
      flightPlans,
    );

    await applyDirectPlans(tx, directPlans);
    await applyDecisionPlans(tx, proposalPlans, attemptPlans);

    const slots: CatalogMigrationConsumerBackfillResult["slots"] = {
      tasting: countPlans(tastingPlans),
      review: countPlans(reviewPlans),
      collection_bottle: countPlans(collectionPlans),
      flight_bottle: countPlans(flightPlans),
      store_price: countPlans(pricePlans),
      incoming_bottle_decision_log: countPlans(decisionPlans),
      "store_price_match_proposal.current": countPlans(proposalPlans.current),
      "store_price_match_proposal.suggested": countPlans(
        proposalPlans.suggested,
      ),
      "store_price_match_attempt.current": countPlans(attemptPlans.current),
      "store_price_match_attempt.suggested": countPlans(attemptPlans.suggested),
    };
    const totals = Object.values(slots).reduce(
      (total, counts) => ({
        rows: total.rows + counts.rows,
        updated: total.updated + counts.updated,
        reused: total.reused + counts.reused,
      }),
      { rows: 0, updated: 0, reused: 0 },
    );
    return { parentId, slots, totals };
  });
}
