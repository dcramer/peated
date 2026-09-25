import { db } from "@peated/server/db";
import {
  bottleReferences,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import {
  BottleCandidateComparisonSchema,
  compareBottleCandidate,
} from "@peated/server/lib/bottleCandidateComparison";
import {
  buildBottleCreateCandidateQueries,
  rankBottleCreateCandidates,
} from "@peated/server/lib/bottleCreateCandidates";
import {
  bottleTextPredicate,
  bottleTextQuery,
  bottleTextScore,
} from "@peated/server/lib/bottleTextSearch";
import { procedure } from "@peated/server/orpc";
import {
  BottleInputFields,
  BottleSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

const candidateColumns = {
  id: bottles.id,
  name: bottles.name,
  fullName: bottles.fullName,
  brandId: bottles.brandId,
  bottlerId: bottles.bottlerId,
  seriesId: bottles.seriesId,
  category: bottles.category,
  edition: bottles.edition,
  statedAge: bottles.statedAge,
  noAgeStatement: bottles.noAgeStatement,
  abv: bottles.abv,
  vintageYear: bottles.vintageYear,
  bottlingYear: bottles.bottlingYear,
  releaseYear: bottles.releaseYear,
  releaseMonth: bottles.releaseMonth,
  releaseDay: bottles.releaseDay,
  caskNumber: bottles.caskNumber,
  singleCask: bottles.singleCask,
  caskStrength: bottles.caskStrength,
};

// TIN rule (bottle-search.md): keep text retrieval in the score-order-and-limit
// shape. Break score ties in memory instead of in the ORDER BY.
async function rankedTextCandidates(where: SQL | undefined) {
  const rows = await db
    .select({ ...candidateColumns, score: bottleTextScore })
    .from(bottles)
    .where(where)
    .orderBy(desc(bottleTextScore))
    .limit(50);
  return rows
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .map(({ score: _score, ...row }) => row);
}

const IdentityChoiceSchema = z.object({
  id: z.number().int().positive().nullish(),
  name: z.string().trim().min(1).max(255),
});

const InputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  brand: IdentityChoiceSchema.nullish(),
  distillers: z.array(IdentityChoiceSchema).max(20).default([]),
  bottler: IdentityChoiceSchema.nullish(),
  series: IdentityChoiceSchema.nullish(),
  category: BottleInputFields.category,
  edition: BottleInputFields.edition,
  statedAge: BottleInputFields.statedAge,
  noAgeStatement: BottleInputFields.noAgeStatement,
  caskStrength: BottleInputFields.caskStrength,
  singleCask: BottleInputFields.singleCask,
  naturalColor: BottleInputFields.naturalColor,
  nonChillFiltered: BottleInputFields.nonChillFiltered,
  maltPhenolPpm: BottleInputFields.maltPhenolPpm,
  abv: BottleInputFields.abv,
  vintageYear: BottleInputFields.vintageYear,
  bottlingYear: BottleInputFields.bottlingYear,
  releaseYear: BottleInputFields.releaseYear,
  releaseMonth: BottleInputFields.releaseMonth,
  releaseDay: BottleInputFields.releaseDay,
  maturation: BottleInputFields.maturation,
  caskNumber: BottleInputFields.caskNumber,
  outturn: BottleInputFields.outturn,
  description: BottleInputFields.description,
  descriptionSrc: BottleInputFields.descriptionSrc,
  flavorProfile: BottleInputFields.flavorProfile,
  tastingNotes: BottleInputFields.tastingNotes,
  limit: z.coerce.number().int().gte(1).lte(10).default(3),
});

export default procedure
  .route({
    method: "GET",
    path: "/bottles/create-candidates",
    summary: "Find possible existing Bottles before creation",
    description:
      "Return advisory Bottle candidates from entered identity and release facts without changing or blocking the submitted Bottle.",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleCreateCandidates",
    }),
  })
  .input(InputSchema)
  .output(
    listResponse(
      BottleSchema.extend({ comparison: BottleCandidateComparisonSchema }),
    ),
  )
  .handler(async ({ input, context }) => {
    const { limit, ...candidateInput } = input;
    const searchQueries = buildBottleCreateCandidateQueries(candidateInput);
    if (!searchQueries.length) {
      return {
        results: [],
        rel: { nextCursor: null, prevCursor: null },
      };
    }

    const tinQuery = bottleTextQuery(input.name, { any: true });
    const active = and(
      isNotNull(bottles.groupId),
      sql`${bottles.id} NOT IN (SELECT ${bottleTombstones.bottleId} FROM ${bottleTombstones})`,
    );
    const distillerIds = input.distillers.flatMap(({ id }) => (id ? [id] : []));
    const identityQueries = [
      ...(input.brand?.id
        ? [
            sql`SELECT ${bottles.id} FROM ${bottles}
        WHERE ${eq(bottles.brandId, input.brand.id)}`,
          ]
        : []),
      ...(distillerIds.length
        ? [
            sql`SELECT ${bottlesToDistillers.bottleId}
        FROM ${bottlesToDistillers}
        WHERE ${inArray(bottlesToDistillers.distillerId, distillerIds)}`,
          ]
        : []),
    ];
    const identity = identityQueries.length
      ? sql`${bottles.id} IN (${sql.join(identityQueries, sql` UNION `)})`
      : undefined;
    const factScore = sql`(
      CASE WHEN ${bottles.caskNumber} = ${input.caskNumber ?? null} THEN 8 ELSE 0 END +
      CASE WHEN ${bottles.statedAge} = ${input.statedAge ?? null} THEN 2 ELSE 0 END +
      CASE WHEN ${bottles.vintageYear} = ${input.vintageYear ?? null} THEN 3 ELSE 0 END +
      CASE WHEN ${bottles.abv} = ${input.abv ?? null} THEN 2 ELSE 0 END
    )`;
    // Candidate discovery owns recall: reserve candidates for known producer
    // relationships before the global text limit can crowd out a rare release.
    // Keep text discovery independent because draft relationships can be wrong.
    const [textRows, identityRows, referenceRows] = await Promise.all([
      rankedTextCandidates(and(active, bottleTextPredicate(tinQuery))),
      identity
        ? db
            .select(candidateColumns)
            .from(bottles)
            .where(and(active, identity))
            .orderBy(desc(factScore), desc(bottles.totalTastings), bottles.id)
            .limit(50)
        : Promise.resolve([]),
      db
        .select(candidateColumns)
        .from(bottles)
        .where(
          and(
            active,
            inArray(
              bottles.id,
              db
                .select({ id: bottleReferences.bottleId })
                .from(bottleReferences)
                .where(
                  and(
                    eq(
                      sql`lower(${bottleReferences.name})`,
                      input.name.toLowerCase(),
                    ),
                    sql`${bottleReferences.ignored} IS NOT TRUE`,
                    isNotNull(bottleReferences.bottleId),
                  ),
                ),
            ),
          ),
        )
        .limit(10),
    ]);
    if (!textRows.length && tinQuery) {
      const fuzzy = bottleTextQuery(input.name, {
        any: true,
        fuzzy: true,
      });
      if (fuzzy !== tinQuery)
        textRows.push(
          ...(await rankedTextCandidates(
            and(active, bottleTextPredicate(fuzzy)),
          )),
        );
    }
    const candidateRows = [
      ...new Map(
        [...referenceRows, ...textRows, ...identityRows].map((b) => [b.id, b]),
      ).values(),
    ];
    if (!candidateRows.length) {
      return { results: [], rel: { nextCursor: null, prevCursor: null } };
    }
    const distillerRows = await db
      .select()
      .from(bottlesToDistillers)
      .where(
        inArray(
          bottlesToDistillers.bottleId,
          candidateRows.map((b) => b.id),
        ),
      );
    const entityIds = [
      ...new Set([
        ...candidateRows.flatMap((b) => [
          b.brandId,
          ...(b.bottlerId ? [b.bottlerId] : []),
        ]),
        ...distillerRows.map((d) => d.distillerId),
      ]),
    ];
    const seriesIds = [
      ...new Set(
        candidateRows.flatMap((b) => (b.seriesId ? [b.seriesId] : [])),
      ),
    ];
    const [entityRows, seriesRows] = await Promise.all([
      db
        .select({ id: entities.id, name: entities.name })
        .from(entities)
        .where(inArray(entities.id, entityIds)),
      seriesIds.length
        ? db
            .select({ id: bottleSeries.id, name: bottleSeries.name })
            .from(bottleSeries)
            .where(inArray(bottleSeries.id, seriesIds))
        : Promise.resolve([]),
    ]);
    const entityById = new Map(entityRows.map((e) => [e.id, e]));
    const seriesById = new Map(seriesRows.map((s) => [s.id, s]));
    const distillersByBottle = new Map<number, typeof entityRows>();
    for (const row of distillerRows) {
      const distiller = entityById.get(row.distillerId);
      if (!distiller) throw new Error(`Missing distiller ${row.distillerId}`);
      const list = distillersByBottle.get(row.bottleId) ?? [];
      list.push(distiller);
      distillersByBottle.set(row.bottleId, list);
    }
    const textPositions = new Map(
      textRows.map((b, index) => [b.id, index + 1]),
    );
    const ranked = rankBottleCreateCandidates(
      candidateInput,
      candidateRows.map((b) => {
        const brand = entityById.get(b.brandId);
        if (!brand) throw new Error(`Missing Brand ${b.brandId}`);
        return {
          ...b,
          exactReference: referenceRows.some((row) => row.id === b.id),
          textRelevance: textPositions.has(b.id)
            ? 1 / textPositions.get(b.id)!
            : undefined,
          brand,
          distillers: distillersByBottle.get(b.id) ?? [],
          bottler: b.bottlerId ? entityById.get(b.bottlerId) : null,
          series: b.seriesId ? seriesById.get(b.seriesId) : null,
        };
      }),
      limit,
    );
    const finalRows = ranked.length
      ? await db
          .select()
          .from(bottles)
          .where(
            inArray(
              bottles.id,
              ranked.map((b) => b.id),
            ),
          )
      : [];
    const rowsById = new Map(finalRows.map((b) => [b.id, b]));
    const serialized = await serialize(
      BottleSerializer,
      ranked.flatMap((b) => {
        const row = rowsById.get(b.id);
        return row ? [row] : [];
      }),
      context.user,
      ["description", "tastingNotes"],
      { includeGroupSummary: true },
    );

    return {
      results: serialized.map((b) => ({
        ...b,
        comparison: compareBottleCandidate(candidateInput, b),
      })),
      rel: { nextCursor: null, prevCursor: null },
    };
  });
