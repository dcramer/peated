import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottleReferences,
  bottles,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import { bottleAliasComparisonKey } from "@peated/server/lib/bottleAliases";
import {
  getBottleReferenceAuditSignals,
  type BottleReferenceAuditSignalKind,
  type ReferenceAuditBottle,
} from "@peated/server/lib/bottleReferenceAuditSignals";
import { getBottleReferenceStateToken } from "@peated/server/lib/bottleReferenceReview";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import {
  and,
  asc,
  eq,
  gt,
  isNotNull,
  isNull,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";

export type BottleReferenceAuditReviewState = "all" | "unreviewed" | "reviewed";

export async function getBottleReferenceAudit(
  {
    after = 0,
    limit = 50,
    reviewState = "all",
    signal,
  }: {
    after?: number;
    limit?: number;
    reviewState?: BottleReferenceAuditReviewState;
    signal?: BottleReferenceAuditSignalKind;
  } = {},
  database: AnyDatabase = db,
) {
  const where: SQL<unknown>[] = [
    gt(bottleReferences.id, after),
    isNotNull(bottleReferences.bottleId),
    sql`${bottleReferences.ignored} IS DISTINCT FROM TRUE`,
    ne(bottleReferences.assignmentSource, "canonical"),
    isNotNull(bottles.groupId),
    sql`LOWER(${bottleReferences.name}) <> LOWER(${bottles.fullName})`,
  ];
  if (reviewState === "unreviewed")
    where.push(isNull(bottleReferences.reviewedAt));
  if (reviewState === "reviewed")
    where.push(isNotNull(bottleReferences.reviewedAt));

  // Signal filtering is computed, so each request scans a fixed-size window.
  const scanLimit = signal ? Math.min(limit * 10 + 1, 501) : limit + 1;
  const candidates = await database
    .select({
      reference: bottleReferences,
      bottle: {
        id: bottles.id,
        fullName: bottles.fullName,
        groupId: bottles.groupId,
        statedAge: bottles.statedAge,
        abv: bottles.abv,
        vintageYear: bottles.vintageYear,
        releaseYear: bottles.releaseYear,
        edition: bottles.edition,
        caskNumber: bottles.caskNumber,
      },
      group: { id: bottleGroups.id, fullName: bottleGroups.fullName },
    })
    .from(bottleReferences)
    .innerJoin(bottles, eq(bottleReferences.bottleId, bottles.id))
    .innerJoin(bottleGroups, eq(bottles.groupId, bottleGroups.id))
    .where(and(...where))
    .orderBy(asc(bottleReferences.id))
    .limit(scanLimit);

  const results = [];
  let scannedThrough = after;
  for (const candidate of candidates) {
    scannedThrough = candidate.reference.id;
    const siblingRows = await database
      .select({
        id: bottles.id,
        fullName: bottles.fullName,
        statedAge: bottles.statedAge,
        abv: bottles.abv,
        vintageYear: bottles.vintageYear,
        releaseYear: bottles.releaseYear,
        edition: bottles.edition,
        caskNumber: bottles.caskNumber,
      })
      .from(bottles)
      .where(
        and(
          eq(bottles.groupId, candidate.bottle.groupId!),
          ne(bottles.id, candidate.bottle.id),
        ),
      )
      .orderBy(asc(bottles.id))
      .limit(25);
    const normalizedKey = normalizeBottleReferenceKey(
      candidate.reference.name,
    ).toLowerCase();
    const overlapRows = await database
      .select({ name: bottleReferences.name })
      .from(bottleReferences)
      .where(
        and(
          ne(bottleReferences.id, candidate.reference.id),
          sql`LOWER(REGEXP_REPLACE(BTRIM(${bottleReferences.name}), '\\s+', ' ', 'g')) = ${normalizedKey}`,
        ),
      )
      .orderBy(asc(bottleReferences.id))
      .limit(10);
    const bottleForSignals: ReferenceAuditBottle = {
      id: candidate.bottle.id,
      fullName: candidate.bottle.fullName,
      statedAge: candidate.bottle.statedAge,
      abv: candidate.bottle.abv,
      vintageYear: candidate.bottle.vintageYear,
      releaseYear: candidate.bottle.releaseYear,
      edition: candidate.bottle.edition,
      caskNumber: candidate.bottle.caskNumber,
    };
    const signals = getBottleReferenceAuditSignals({
      referenceName: candidate.reference.name,
      bottle: bottleForSignals,
      siblings: siblingRows,
      normalizedOverlapNames: overlapRows.map(({ name }) => name),
    });
    if (signal && !signals.some(({ kind }) => kind === signal)) continue;

    const impactWhere = (table: typeof storePrices | typeof externalReviews) =>
      and(
        eq(table.bottleId, candidate.bottle.id),
        eq(sql`LOWER(${table.name})`, candidate.reference.name.toLowerCase()),
        eq(table.hidden, false),
      );
    const [[priceCount], priceIds, [reviewCount], reviewIds, displayAlias] =
      await Promise.all([
        database
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(storePrices)
          .where(impactWhere(storePrices)),
        database
          .select({ id: storePrices.id })
          .from(storePrices)
          .where(impactWhere(storePrices))
          .orderBy(asc(storePrices.id))
          .limit(10),
        database
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(externalReviews)
          .where(impactWhere(externalReviews))
          .then((rows) => rows),
        database
          .select({ id: externalReviews.id })
          .from(externalReviews)
          .where(impactWhere(externalReviews))
          .orderBy(asc(externalReviews.id))
          .limit(10),
        database.query.bottleAliases.findFirst({
          where: and(
            eq(bottleAliases.bottleId, candidate.bottle.id),
            eq(
              bottleAliases.normalizedName,
              bottleAliasComparisonKey(candidate.reference.name),
            ),
          ),
        }),
      ]);

    results.push({
      id: candidate.reference.id,
      name: candidate.reference.name,
      assignmentSource: candidate.reference.assignmentSource,
      reviewedAt: candidate.reference.reviewedAt?.toISOString() ?? null,
      stateToken: getBottleReferenceStateToken(candidate.reference),
      displayAlias: displayAlias
        ? { id: displayAlias.id, name: displayAlias.name }
        : null,
      bottle: { ...candidate.bottle, groupId: candidate.bottle.groupId! },
      group: {
        ...candidate.group,
        siblings: siblingRows.map(({ id, fullName }) => ({ id, fullName })),
      },
      signals,
      impact: {
        prices: {
          count: priceCount?.count ?? 0,
          ids: priceIds.map(({ id }) => id),
        },
        reviews: {
          count: reviewCount?.count ?? 0,
          ids: reviewIds.map(({ id }) => id),
        },
      },
    });
    if (results.length === limit) break;
  }

  const hasMore = candidates.length === scanLimit || results.length === limit;
  return { results, nextCursor: hasMore ? scannedThrough : null };
}
