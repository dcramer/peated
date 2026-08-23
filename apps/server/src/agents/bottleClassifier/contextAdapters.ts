import {
  BottleContextSourceSchema,
  EntityContextSchema,
  MAX_BOTTLE_CONTEXT_ALIASES,
  MAX_BOTTLE_CONTEXT_IMAGES,
  MAX_BOTTLE_CONTEXT_OBSERVATION_DATA_LENGTH,
  MAX_BOTTLE_CONTEXT_OBSERVATION_TEXT_LENGTH,
  MAX_BOTTLE_CONTEXT_OBSERVATIONS,
  MAX_BOTTLE_CONTEXT_SIBLINGS,
  MAX_ENTITY_CONTEXT_ALIASES,
  MAX_ENTITY_CONTEXT_BOTTLES,
  type BottleContextExact,
  type BottleContextSource,
  type EntityContext,
} from "@peated/bottle-classifier/internal/types";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleObservations,
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  countries,
  entities,
  entityAliases,
  entityTombstones,
  regions,
  tastings,
  users,
  type BottleObservation,
} from "@peated/server/db/schema";
import { getUploadImageDataUrl } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { and, asc, desc, eq, isNotNull, notExists } from "drizzle-orm";

function exactBottleContext(
  bottle: {
    statedAge: number | null;
    edition: string | null;
    abv: number | null;
    singleCask: boolean | null;
    caskStrength: boolean | null;
    vintageYear: number | null;
    releaseYear: number | null;
    caskSize: BottleContextExact["caskSize"];
    caskType: BottleContextExact["caskType"];
    caskFill: BottleContextExact["caskFill"];
  },
  sharedStatedAge: number | null,
): BottleContextExact {
  return {
    edition: bottle.edition,
    statedAge: bottle.statedAge !== sharedStatedAge ? bottle.statedAge : null,
    abv: bottle.abv,
    singleCask: bottle.singleCask,
    caskStrength: bottle.caskStrength,
    vintageYear: bottle.vintageYear,
    releaseYear: bottle.releaseYear,
    caskSize: bottle.caskSize,
    caskType: bottle.caskType,
    caskFill: bottle.caskFill,
  };
}

function normalizedOptionalText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizedHttpUrl(value: string | null) {
  const normalized = normalizedOptionalText(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:"
      ? normalized
      : null;
  } catch {
    return null;
  }
}

/** Resolves Peated-owned images without asking a model provider to refetch them. */
export async function getBottleClassifierImageInput(
  imageUrl: string,
): Promise<string> {
  const parsedImageUrl = new URL(imageUrl);
  const apiUrl = new URL(config.API_SERVER);
  if (
    parsedImageUrl.origin !== apiUrl.origin ||
    !parsedImageUrl.pathname.startsWith("/uploads/")
  ) {
    return imageUrl;
  }

  return await getUploadImageDataUrl(imageUrl);
}

function boundedObservationData(
  value: BottleObservation["facts"] | BottleObservation["parsedIdentity"],
) {
  return value &&
    JSON.stringify(value).length <= MAX_BOTTLE_CONTEXT_OBSERVATION_DATA_LENGTH
    ? value
    : null;
}

export async function getBottleClassifierContext(
  bottleId: number,
): Promise<BottleContextSource | null> {
  const [tombstone, bottle] = await Promise.all([
    db.query.bottleTombstones.findFirst({
      where: eq(bottleTombstones.bottleId, bottleId),
      columns: { bottleId: true },
    }),
    db.query.bottles.findFirst({
      where: eq(bottles.id, bottleId),
      with: {
        brand: true,
        bottler: true,
        series: true,
        bottlesToDistillers: {
          with: { distiller: true },
        },
        group: {
          with: {
            brand: true,
            bottler: true,
            series: true,
            distillers: {
              with: { distiller: true },
            },
          },
        },
      },
    }),
  ]);
  if (tombstone || !bottle?.brand) {
    return null;
  }

  const [aliases, observations, tastingImages, siblingBottles] =
    await Promise.all([
      db
        .select({
          name: bottleAliases.name,
          ignored: bottleAliases.ignored,
        })
        .from(bottleAliases)
        .where(eq(bottleAliases.bottleId, bottleId))
        .orderBy(asc(bottleAliases.name))
        .limit(MAX_BOTTLE_CONTEXT_ALIASES),
      db
        .select({
          sourceType: bottleObservations.sourceType,
          sourceKey: bottleObservations.sourceKey,
          sourceName: bottleObservations.sourceName,
          sourceUrl: bottleObservations.sourceUrl,
          rawText: bottleObservations.rawText,
          parsedIdentity: bottleObservations.parsedIdentity,
          facts: bottleObservations.facts,
        })
        .from(bottleObservations)
        .where(eq(bottleObservations.bottleId, bottleId))
        .orderBy(desc(bottleObservations.id))
        .limit(MAX_BOTTLE_CONTEXT_OBSERVATIONS),
      db
        .select({
          tastingId: tastings.id,
          imageUrl: tastings.imageUrl,
        })
        .from(tastings)
        .innerJoin(users, eq(users.id, tastings.createdById))
        .where(
          and(
            eq(tastings.bottleId, bottleId),
            isNotNull(tastings.imageUrl),
            eq(users.private, false),
            eq(users.active, true),
          ),
        )
        .orderBy(desc(tastings.createdAt), desc(tastings.id))
        .limit(MAX_BOTTLE_CONTEXT_IMAGES),
      bottle.groupId
        ? db
            .select({
              bottleId: bottles.id,
              fullName: bottles.fullName,
              statedAge: bottles.statedAge,
              edition: bottles.edition,
              abv: bottles.abv,
              singleCask: bottles.singleCask,
              caskStrength: bottles.caskStrength,
              vintageYear: bottles.vintageYear,
              releaseYear: bottles.releaseYear,
              caskSize: bottles.caskSize,
              caskType: bottles.caskType,
              caskFill: bottles.caskFill,
            })
            .from(bottles)
            .where(
              and(
                eq(bottles.groupId, bottle.groupId),
                notExists(
                  db
                    .select({ bottleId: bottleTombstones.bottleId })
                    .from(bottleTombstones)
                    .where(eq(bottleTombstones.bottleId, bottles.id)),
                ),
              ),
            )
            .orderBy(asc(bottles.id))
            .limit(MAX_BOTTLE_CONTEXT_SIBLINGS + 1)
        : Promise.resolve([]),
    ]);

  const group = bottle.group;
  const sharedBrand = group?.brand ?? bottle.brand;
  const sharedBottler = group ? group.bottler : bottle.bottler;
  const sharedSeries = group ? group.series : bottle.series;
  const sharedDistillers = (
    group
      ? group.distillers.map(({ distiller }) => distiller)
      : bottle.bottlesToDistillers.map(({ distiller }) => distiller)
  )
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity))
    .sort((left, right) => left.id - right.id);
  const sharedStatedAge = group ? group.statedAge : bottle.statedAge;
  const siblings = siblingBottles
    .filter((sibling) => sibling.bottleId !== bottleId)
    .slice(0, MAX_BOTTLE_CONTEXT_SIBLINGS)
    .map((sibling) => ({
      bottleId: sibling.bottleId,
      fullName: sibling.fullName,
      exact: exactBottleContext(sibling, sharedStatedAge),
    }));

  const imageSources: BottleContextSource["imageSources"] = [];
  if (bottle.imageUrl) {
    imageSources.push({
      source: { kind: "bottle" },
      url: absoluteUrl(config.API_SERVER, bottle.imageUrl),
    });
  }
  for (const tasting of tastingImages) {
    if (!tasting.imageUrl || imageSources.length >= MAX_BOTTLE_CONTEXT_IMAGES) {
      break;
    }
    const url = absoluteUrl(config.API_SERVER, tasting.imageUrl);
    if (imageSources.some((image) => image.url === url)) {
      continue;
    }
    imageSources.push({
      source: { kind: "tasting", tastingId: tasting.tastingId },
      url,
    });
  }

  return BottleContextSourceSchema.parse({
    bottleId: bottle.id,
    fullName: bottle.fullName,
    groupId: bottle.groupId,
    shared: {
      name: group?.name ?? bottle.name,
      statedAge: sharedStatedAge,
      series: sharedSeries
        ? { seriesId: sharedSeries.id, name: sharedSeries.name }
        : null,
      category: group ? group.category : bottle.category,
      brand: {
        entityId: sharedBrand.id,
        name: sharedBrand.name,
      },
      distillers: sharedDistillers.map((distiller) => ({
        entityId: distiller.id,
        name: distiller.name,
      })),
      bottler: sharedBottler
        ? {
            entityId: sharedBottler.id,
            name: sharedBottler.name,
          }
        : null,
    },
    exact: exactBottleContext(bottle, sharedStatedAge),
    siblings,
    aliases: aliases.map(({ name, ignored }) => ({ name, ignored: !!ignored })),
    observations: observations.map((observation) => ({
      ...observation,
      sourceUrl: observation.sourceUrl
        ? absoluteUrl(config.API_SERVER, observation.sourceUrl)
        : null,
      rawText:
        normalizedOptionalText(observation.rawText)?.slice(
          0,
          MAX_BOTTLE_CONTEXT_OBSERVATION_TEXT_LENGTH,
        ) ?? null,
      parsedIdentity: boundedObservationData(observation.parsedIdentity),
      facts: boundedObservationData(observation.facts),
    })),
    imageSources,
  });
}

export async function getEntityClassifierContext(
  entityId: number,
): Promise<EntityContext | null> {
  const [entity] = await db
    .select({
      entityId: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      roles: entities.type,
      website: entities.website,
      country: countries.name,
      region: regions.name,
      yearEstablished: entities.yearEstablished,
    })
    .from(entities)
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(
      and(
        eq(entities.id, entityId),
        notExists(
          db
            .select({ entityId: entityTombstones.entityId })
            .from(entityTombstones)
            .where(eq(entityTombstones.entityId, entityId)),
        ),
      ),
    )
    .limit(1);
  if (!entity) {
    return null;
  }

  const [aliases, brandBottles, bottlerBottles, distillerBottles] =
    await Promise.all([
      db
        .select({ name: entityAliases.name })
        .from(entityAliases)
        .where(eq(entityAliases.entityId, entityId))
        .orderBy(asc(entityAliases.name))
        .limit(MAX_ENTITY_CONTEXT_ALIASES),
      db
        .select({ bottleId: bottles.id, fullName: bottles.fullName })
        .from(bottles)
        .where(
          and(
            eq(bottles.brandId, entityId),
            notExists(
              db
                .select({ bottleId: bottleTombstones.bottleId })
                .from(bottleTombstones)
                .where(eq(bottleTombstones.bottleId, bottles.id)),
            ),
          ),
        )
        .orderBy(asc(bottles.id))
        .limit(MAX_ENTITY_CONTEXT_BOTTLES),
      db
        .select({ bottleId: bottles.id, fullName: bottles.fullName })
        .from(bottles)
        .where(
          and(
            eq(bottles.bottlerId, entityId),
            notExists(
              db
                .select({ bottleId: bottleTombstones.bottleId })
                .from(bottleTombstones)
                .where(eq(bottleTombstones.bottleId, bottles.id)),
            ),
          ),
        )
        .orderBy(asc(bottles.id))
        .limit(MAX_ENTITY_CONTEXT_BOTTLES),
      db
        .select({ bottleId: bottles.id, fullName: bottles.fullName })
        .from(bottlesToDistillers)
        .innerJoin(bottles, eq(bottles.id, bottlesToDistillers.bottleId))
        .where(
          and(
            eq(bottlesToDistillers.distillerId, entityId),
            notExists(
              db
                .select({ bottleId: bottleTombstones.bottleId })
                .from(bottleTombstones)
                .where(eq(bottleTombstones.bottleId, bottles.id)),
            ),
          ),
        )
        .orderBy(asc(bottles.id))
        .limit(MAX_ENTITY_CONTEXT_BOTTLES),
    ]);

  const relatedBottles = new Map<
    number,
    EntityContext["relatedBottles"][number]
  >();
  for (const [relationship, rows] of [
    ["brand", brandBottles],
    ["bottler", bottlerBottles],
    ["distiller", distillerBottles],
  ] as const) {
    for (const bottle of rows) {
      const existing = relatedBottles.get(bottle.bottleId);
      if (existing) {
        if (!existing.relationships.includes(relationship)) {
          existing.relationships.push(relationship);
        }
        continue;
      }
      if (relatedBottles.size >= MAX_ENTITY_CONTEXT_BOTTLES) {
        continue;
      }
      relatedBottles.set(bottle.bottleId, {
        ...bottle,
        relationships: [relationship],
      });
    }
  }

  return EntityContextSchema.parse({
    ...entity,
    shortName: normalizedOptionalText(entity.shortName),
    website: normalizedHttpUrl(entity.website),
    aliases: aliases
      .map(({ name }) => name.trim())
      .filter((name) => name.length > 0),
    relatedBottles: Array.from(relatedBottles.values()),
  });
}
