import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  countries,
  entities,
  regions,
  type EntityKind,
} from "@peated/server/db/schema";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityKindEnum,
  EntitySchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { RegionSerializer } from "@peated/server/serializers/region";
import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    cursor: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe("Last Entity ID returned by the previous page"),
    limit: z.coerce.number().int().gte(1).lte(500).default(100),
  })
  .default({ cursor: 0, limit: 100 });

const BackfillEntitySchema = EntitySchema.extend({
  kind: z.null(),
  type: z.array(z.enum(["brand", "distiller", "bottler"])),
  suggestedKind: EntityKindEnum.nullable(),
  relationships: z.object({
    brand: z.number().int().nonnegative(),
    bottler: z.number().int().nonnegative(),
    distiller: z.number().int().nonnegative(),
  }),
});

const activeBottleCondition = and(
  isNotNull(bottles.groupId),
  sql`NOT EXISTS(
    SELECT FROM ${bottleTombstones}
    WHERE ${bottleTombstones.bottleId} = ${bottles.id}
  )`,
);

function countsByEntity(
  rows: { count: number; entityId: number | null }[],
): Map<number, number> {
  return new Map(
    rows.flatMap((row) =>
      row.entityId === null ? [] : [[row.entityId, row.count]],
    ),
  );
}

export function inferKindFromLegacyTypes(
  legacyTypes: ("brand" | "bottler" | "distiller")[],
): EntityKind | null {
  if (legacyTypes.includes("distiller")) return "distillery";
  if (legacyTypes.includes("bottler")) return "bottler";
  if (legacyTypes.includes("brand")) return "brand";
  return null;
}

// This preparation route is the only boundary that permits a null kind or
// reads the legacy type list. Remove it after the final cutover is stable.
export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/entities/kind-backfill",
    summary: "List Entities that need a kind",
    description:
      "List legacy Entities without a kind and include their legacy types, suggested kind, and active Bottle-use counts",
    spec: (spec) => ({
      ...spec,
      operationId: "listEntityKindBackfill",
    }),
  })
  .input(InputSchema)
  .output(listResponse(BackfillEntitySchema))
  .handler(async function ({ input, context }) {
    const rows = await db
      .select()
      .from(entities)
      .where(and(isNull(entities.kind), gt(entities.id, input.cursor)))
      .orderBy(asc(entities.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    const entityIds = page.map((entity) => entity.id);

    if (entityIds.length === 0) {
      return {
        results: [],
        rel: { nextCursor: null, prevCursor: null },
      };
    }

    const countryIds = page.flatMap((entity) =>
      entity.countryId === null ? [] : [entity.countryId],
    );
    const regionIds = page.flatMap((entity) =>
      entity.regionId === null ? [] : [entity.regionId],
    );
    const ownerIds = page.flatMap((entity) =>
      entity.ownerId === null ? [] : [entity.ownerId],
    );

    const [
      countryRows,
      regionRows,
      ownerRows,
      brandRows,
      bottlerRows,
      distillerRows,
    ] = await Promise.all([
      countryIds.length
        ? db.select().from(countries).where(inArray(countries.id, countryIds))
        : Promise.resolve([]),
      regionIds.length
        ? db.select().from(regions).where(inArray(regions.id, regionIds))
        : Promise.resolve([]),
      ownerIds.length
        ? db
            .select({ id: entities.id, name: entities.name })
            .from(entities)
            .where(inArray(entities.id, ownerIds))
        : Promise.resolve([]),
      db
        .select({
          entityId: bottles.brandId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(bottles)
        .where(and(activeBottleCondition, inArray(bottles.brandId, entityIds)))
        .groupBy(bottles.brandId),
      db
        .select({
          entityId: bottles.bottlerId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(bottles)
        .where(
          and(activeBottleCondition, inArray(bottles.bottlerId, entityIds)),
        )
        .groupBy(bottles.bottlerId),
      db
        .select({
          entityId: bottlesToDistillers.distillerId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(bottlesToDistillers)
        .innerJoin(bottles, eq(bottles.id, bottlesToDistillers.bottleId))
        .where(
          and(
            activeBottleCondition,
            inArray(bottlesToDistillers.distillerId, entityIds),
          ),
        )
        .groupBy(bottlesToDistillers.distillerId),
    ]);

    const countriesById = new Map(
      (await serialize(CountrySerializer, countryRows, context.user)).map(
        (country, index) => [countryRows[index]!.id, country],
      ),
    );
    const regionsById = new Map(
      (await serialize(RegionSerializer, regionRows, context.user)).map(
        (region, index) => [regionRows[index]!.id, region],
      ),
    );
    const ownersById = new Map(
      ownerRows.map((owner) => [
        owner.id,
        {
          id: owner.id,
          peatedId: formatPeatedId("entity", owner.id),
          name: owner.name,
        },
      ]),
    );
    const brandCounts = countsByEntity(brandRows);
    const bottlerCounts = countsByEntity(bottlerRows);
    const distillerCounts = countsByEntity(distillerRows);

    return {
      results: page.map((entity) => ({
        id: entity.id,
        peatedId: formatPeatedId("entity", entity.id),
        name: entity.name,
        shortName: entity.shortName,
        kind: null,
        type: entity.type,
        suggestedKind: inferKindFromLegacyTypes(entity.type),
        ownerId: entity.ownerId,
        owner: entity.ownerId ? (ownersById.get(entity.ownerId) ?? null) : null,
        description: entity.description,
        descriptionSrc: entity.descriptionSrc,
        yearEstablished: entity.yearEstablished,
        website: entity.website,
        country: entity.countryId
          ? (countriesById.get(entity.countryId) ?? null)
          : null,
        region: entity.regionId
          ? (regionsById.get(entity.regionId) ?? null)
          : null,
        address: entity.address,
        location: entity.location,
        totalTastings: entity.totalTastings,
        totalBottles: entity.totalBottles,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        relationships: {
          brand: brandCounts.get(entity.id) ?? 0,
          bottler: bottlerCounts.get(entity.id) ?? 0,
          distiller: distillerCounts.get(entity.id) ?? 0,
        },
      })),
      rel: {
        nextCursor:
          rows.length > input.limit ? page[page.length - 1]!.id : null,
        prevCursor: null,
      },
    };
  });
