import type { ProposedOperation } from "@peated/bottle-classifier";
import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import type { AnyDatabase } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import {
  getBottleExactIdentity,
  materializeBottleIdentity,
} from "@peated/server/lib/bottleIdentity";
import { formatBottleName } from "@peated/server/lib/format";
import {
  EntityUpdateInputSchema,
  type EntityUpdateExpectedState,
  type EntityUpdateInput,
} from "@peated/server/lib/updateEntity";
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  gt,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  MAX_OPERATION_PREVIEW_IDS,
  PreparedEntityMergeDataSchema,
  PreparedEntityUpdateDataSchema,
} from "../bottleOperationReviewSchemas";
import { entityRelationshipState } from "./relationships";
import {
  entityPreviewState,
  fail,
  loadEntity,
  relationshipDigest,
  requireInspectedEntity,
  requireNoEntityIdentityCollision,
  resolveLocation,
  sameValue,
  sortedRoles,
  type EntityWithLocation,
  type ParsedPreparationContext,
  type PreparedOperationExecution,
} from "./shared";

async function entityImpact(database: AnyDatabase, entityId: number) {
  const bottlesCount = await database
    .select({ total: countDistinct(bottles.id) })
    .from(bottles)
    .leftJoin(bottlesToDistillers, eq(bottlesToDistillers.bottleId, bottles.id))
    .where(
      or(
        eq(bottles.brandId, entityId),
        eq(bottles.bottlerId, entityId),
        eq(bottlesToDistillers.distillerId, entityId),
      ),
    )
    .then(([row]) => row?.total ?? 0);
  const brandGroups = await database
    .select({ total: count() })
    .from(bottleGroups)
    .where(eq(bottleGroups.brandId, entityId))
    .then(([row]) => row?.total ?? 0);
  const bottlerGroups = await database
    .select({ total: count() })
    .from(bottleGroups)
    .where(eq(bottleGroups.bottlerId, entityId))
    .then(([row]) => row?.total ?? 0);
  const distillerGroups = await database
    .select({ total: countDistinct(bottleGroupDistillers.groupId) })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.distillerId, entityId))
    .then(([row]) => row?.total ?? 0);
  const seriesCount = await database
    .select({ total: count() })
    .from(bottleSeries)
    .where(eq(bottleSeries.brandId, entityId))
    .then(([row]) => row?.total ?? 0);
  const aliasCount = await database
    .select({ total: count() })
    .from(entityAliases)
    .where(eq(entityAliases.entityId, entityId))
    .then(([row]) => row?.total ?? 0);
  return {
    bottles: bottlesCount,
    brandGroups,
    bottlerGroups,
    distillerGroups,
    series: seriesCount,
    aliases: aliasCount,
  };
}

async function resolveEntityUpdateInput({
  current,
  proposal,
  database,
}: {
  current: EntityWithLocation;
  proposal: Extract<ProposedOperation, { type: "update_entity" }>;
  database: AnyDatabase;
}) {
  const patch = proposal.input.patch;
  const name =
    patch.name === undefined
      ? current.entity.name
      : normalizeEntityName(patch.name);
  const shortName =
    patch.shortName === undefined ? current.entity.shortName : patch.shortName;
  if (patch.name !== undefined || patch.shortName !== undefined) {
    await requireNoEntityIdentityCollision({
      entityId: current.entity.id,
      names: [
        name,
        shortName,
        name.startsWith("The ") ? name.substring(4) : null,
      ],
      database,
    });
  }

  let country = current.country;
  let region = current.region;
  if (patch.country === null) {
    country = null;
    region = null;
  } else if (patch.country !== undefined) {
    ({ country } = await resolveLocation({
      countryName: patch.country,
      regionName: undefined,
      database,
    }));
    if (country?.id !== current.country?.id) region = null;
  }
  if (patch.region === null) {
    region = null;
  } else if (patch.region !== undefined) {
    if (!country) {
      fail(
        "invalid_current_state",
        `Region "${patch.region}" requires a resolved country.`,
      );
    }
    ({ region } = await resolveLocation({
      countryName: country.name,
      regionName: patch.region,
      database,
    }));
  }

  const input: EntityUpdateInput = EntityUpdateInputSchema.parse({
    ...(patch.name !== undefined ? { name } : {}),
    ...(patch.shortName !== undefined ? { shortName } : {}),
    ...(patch.roles !== undefined ? { type: sortedRoles(patch.roles) } : {}),
    ...(patch.website !== undefined ? { website: patch.website } : {}),
    ...(patch.country !== undefined ? { country: country?.id ?? null } : {}),
    ...(patch.region !== undefined || patch.country !== undefined
      ? { region: region?.id ?? null }
      : {}),
    ...(patch.yearEstablished !== undefined
      ? { yearEstablished: patch.yearEstablished }
      : {}),
  });
  return {
    input,
    after: {
      entityId: current.entity.id,
      name,
      shortName,
      roles:
        input.type === undefined
          ? sortedRoles(current.entity.type)
          : sortedRoles(input.type),
      website:
        input.website === undefined ? current.entity.website : input.website,
      location: {
        country,
        region: region ? { id: region.id, name: region.name } : null,
      },
      yearEstablished:
        input.yearEstablished === undefined
          ? current.entity.yearEstablished
          : input.yearEstablished,
    },
    referencedCountry: country,
    referencedRegion: region,
  };
}

function entityChangedFields(
  before: ReturnType<typeof entityPreviewState>,
  after: ReturnType<typeof entityPreviewState>,
) {
  return (
    [
      ["name", before.name, after.name],
      ["shortName", before.shortName, after.shortName],
      ["roles", before.roles, after.roles],
      ["website", before.website, after.website],
      [
        "country",
        before.location.country?.id ?? null,
        after.location.country?.id ?? null,
      ],
      [
        "region",
        before.location.region?.id ?? null,
        after.location.region?.id ?? null,
      ],
      ["yearEstablished", before.yearEstablished, after.yearEstablished],
    ] as const
  )
    .filter(([, previous, next]) => !sameValue(previous, next))
    .map(([field]) => field);
}

export async function prepareEntityUpdate(
  proposal: Extract<ProposedOperation, { type: "update_entity" }>,
  context: ParsedPreparationContext,
): Promise<Extract<PreparedOperationExecution, { type: "update_entity" }>> {
  requireInspectedEntity(proposal.input.entityId, context);
  const current = await loadEntity(context.database, proposal.input.entityId);
  const before = entityPreviewState(current);
  const resolved = await resolveEntityUpdateInput({
    current,
    proposal,
    database: context.database,
  });
  const changedFields = entityChangedFields(before, resolved.after);
  if (changedFields.length === 0) {
    fail(
      "no_changes",
      `Entity ${current.entity.id} already has the proposed state.`,
    );
  }

  const tokenFields: EntityUpdateExpectedState["fields"] = {};
  for (const field of Object.keys(proposal.input.patch)) {
    switch (field) {
      case "roles":
        tokenFields.roles = sortedRoles(current.entity.type);
        break;
      case "country":
      case "region":
        tokenFields.countryId = current.entity.countryId;
        tokenFields.regionId = current.entity.regionId;
        break;
      case "name":
        tokenFields.name = current.entity.name;
        break;
      case "shortName":
        tokenFields.shortName = current.entity.shortName;
        break;
      case "website":
        tokenFields.website = current.entity.website;
        break;
      case "yearEstablished":
        tokenFields.yearEstablished = current.entity.yearEstablished;
        break;
    }
  }
  const locationTouched =
    proposal.input.patch.country !== undefined ||
    proposal.input.patch.region !== undefined;
  const relationshipsTouched =
    proposal.input.patch.name !== undefined ||
    proposal.input.patch.shortName !== undefined;

  return {
    type: proposal.type,
    review: PreparedEntityUpdateDataSchema.parse({
      type: proposal.type,
      proposal,
      preview: {
        before,
        after: resolved.after,
        changedFields,
        impact: await entityImpact(context.database, current.entity.id),
        warnings: [],
      },
      stateToken: {
        entityId: current.entity.id,
        fields: tokenFields,
        referencedCountry: locationTouched ? resolved.referencedCountry : null,
        referencedRegion: locationTouched ? resolved.referencedRegion : null,
        ...(relationshipsTouched
          ? {
              relationshipDigest: relationshipDigest(
                await entityRelationshipState(
                  context.database,
                  [current.entity.id],
                  true,
                ),
              ),
            }
          : {}),
      },
    }),
    canonicalInput: {
      entityId: proposal.input.entityId,
      input: resolved.input,
      expectedState: {
        fields: tokenFields,
        referencedCountry: locationTouched ? resolved.referencedCountry : null,
        referencedRegion: locationTouched ? resolved.referencedRegion : null,
      },
    },
  };
}

async function entityAliasesFor(database: AnyDatabase, entityId: number) {
  return database
    .select({ name: entityAliases.name })
    .from(entityAliases)
    .where(eq(entityAliases.entityId, entityId))
    .orderBy(asc(entityAliases.name))
    .then((rows) => rows.map(({ name }) => name));
}

function entityMergeIdentityState(
  current: EntityWithLocation,
  aliases: string[],
  tombstoneDestinationEntityId: number | null,
) {
  return {
    entityId: current.entity.id,
    name: current.entity.name,
    shortName: current.entity.shortName,
    roles: sortedRoles(current.entity.type),
    aliasDigest: relationshipDigest(aliases),
    tombstoneDestinationEntityId,
  };
}

function entityMergeSourceState(
  current: EntityWithLocation,
  aliases: string[],
  tombstoneDestinationEntityId: number | null,
) {
  return {
    ...entityMergeIdentityState(current, aliases, tombstoneDestinationEntityId),
    website: current.entity.website,
    countryId: current.entity.countryId,
    regionId: current.entity.regionId,
    yearEstablished: current.entity.yearEstablished,
  };
}

async function entityMergeCollisions(
  database: AnyDatabase,
  source: EntityWithLocation,
  destination: EntityWithLocation,
) {
  const [seriesCollisions] = await database
    .select({ total: count() })
    .from(bottleSeries)
    .where(
      and(
        eq(bottleSeries.brandId, source.entity.id),
        sql`EXISTS (
          SELECT 1
          FROM bottle_series destination_series
          WHERE destination_series.brand_id = ${destination.entity.id}
            AND LOWER(destination_series.name) = LOWER(${bottleSeries.name})
        )`,
      ),
    );

  let bottleIdentities = 0;
  let afterBottleId = 0;
  while (true) {
    const sourceBrandBottles = await database
      .select({
        bottle: bottles,
        group: bottleGroups,
      })
      .from(bottles)
      .innerJoin(bottleGroups, eq(bottleGroups.id, bottles.groupId))
      .where(
        and(
          eq(bottleGroups.brandId, source.entity.id),
          gt(bottles.id, afterBottleId),
        ),
      )
      .orderBy(asc(bottles.id))
      .limit(MAX_OPERATION_PREVIEW_IDS);
    if (sourceBrandBottles.length === 0) break;
    afterBottleId = sourceBrandBottles.at(-1)!.bottle.id;
    const desiredNames = sourceBrandBottles.map(({ bottle, group }) => {
      const stableFullName = formatBottleName({
        name: `${destination.entity.shortName || destination.entity.name} ${group.name}`,
      });
      return materializeBottleIdentity({
        stable: {
          name: group.name,
          fullName: stableFullName,
          statedAge: group.statedAge,
        },
        exact: getBottleExactIdentity({
          bottle,
          sourceGroupStatedAge: group.statedAge,
        }),
      }).fullName.toLowerCase();
    });
    const destinationNames = new Set(
      await database
        .select({ fullName: sql<string>`LOWER(${bottles.fullName})` })
        .from(bottles)
        .where(
          and(
            eq(bottles.brandId, destination.entity.id),
            inArray(sql<string>`LOWER(${bottles.fullName})`, desiredNames),
          ),
        )
        .then((rows) => rows.map(({ fullName }) => fullName)),
    );
    bottleIdentities += desiredNames.filter((name) =>
      destinationNames.has(name),
    ).length;
  }

  return {
    bottleIdentities,
    series: seriesCollisions?.total ?? 0,
  };
}

export async function prepareEntityMerge(
  proposal: Extract<ProposedOperation, { type: "merge_entities" }>,
  context: ParsedPreparationContext,
): Promise<Extract<PreparedOperationExecution, { type: "merge_entities" }>> {
  const { sourceEntityId, destinationEntityId } = proposal.input;
  requireInspectedEntity(sourceEntityId, context);
  requireInspectedEntity(destinationEntityId, context);
  const source = await loadEntity(context.database, sourceEntityId);
  const destination = await loadEntity(context.database, destinationEntityId);
  const sourceAliases = await entityAliasesFor(
    context.database,
    sourceEntityId,
  );
  const destinationAliases = await entityAliasesFor(
    context.database,
    destinationEntityId,
  );
  const tombstones = await context.database
    .select()
    .from(entityTombstones)
    .where(
      inArray(entityTombstones.entityId, [sourceEntityId, destinationEntityId]),
    );
  if (tombstones.length > 0) {
    fail("invalid_current_state", "An Entity merge target is already retired.");
  }
  const roles = sortedRoles([
    ...source.entity.type,
    ...destination.entity.type,
  ]);
  const after = {
    ...entityPreviewState(destination),
    roles,
  };
  const collisions = await entityMergeCollisions(
    context.database,
    source,
    destination,
  );
  const warnings = [
    ...(!sameValue(roles, sortedRoles(destination.entity.type))
      ? [
          {
            code: "role_union" as const,
            message: "The survivor will retain the union of both Entity roles.",
          },
        ]
      : []),
    ...(collisions.bottleIdentities > 0
      ? [
          {
            code: "bottle_identity_collision_resolved" as const,
            message: `${collisions.bottleIdentities} exact Bottle identity collisions will be consolidated by the canonical Entity merge.`,
          },
        ]
      : []),
    ...(collisions.series > 0
      ? [
          {
            code: "series_collision_resolved" as const,
            message: `${collisions.series} BottleSeries collisions will be consolidated by the canonical Entity merge.`,
          },
        ]
      : []),
  ];

  return {
    type: proposal.type,
    review: PreparedEntityMergeDataSchema.parse({
      type: proposal.type,
      proposal,
      preview: {
        source: entityPreviewState(source),
        destination: entityPreviewState(destination),
        after,
        impact: await entityImpact(context.database, sourceEntityId),
        collisions,
        outcome: {
          retiredEntityId: sourceEntityId,
          survivorEntityId: destinationEntityId,
        },
        warnings,
      },
      stateToken: {
        source: entityMergeSourceState(source, sourceAliases, null),
        destination: entityMergeIdentityState(
          destination,
          destinationAliases,
          null,
        ),
        relationshipDigest: relationshipDigest(
          await entityRelationshipState(context.database, [
            sourceEntityId,
            destinationEntityId,
          ]),
        ),
      },
    }),
    canonicalInput: {
      sourceEntityId,
      destinationEntityId,
    },
  };
}
