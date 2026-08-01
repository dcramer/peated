import {
  type BottleOperationEntityChoice,
  type ProposedOperation,
} from "@peated/bottle-classifier";
import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleAliasKey,
  normalizeEntityName,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import type { AnyDatabase } from "@peated/server/db";
import type {
  Bottle,
  BottleGroup,
  BottleSeries,
  Entity,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroupDistillers,
  bottleGroups,
  bottleObservations,
  bottles,
  bottleSeries,
  bottleTags,
  bottleTombstones,
  collectionBottles,
  entities,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import {
  getConcreteBottleExactIdentity,
  materializeConcreteBottleIdentity,
  type ConcreteBottleExactIdentity,
} from "@peated/server/lib/concreteBottleIdentity";
import {
  ConcreteBottleUpdateInputSchema,
  type ConcreteBottleUpdateInput,
} from "@peated/server/lib/concreteBottleSchemas";
import { formatBottleName } from "@peated/server/lib/format";
import {
  concreteBottleUpdateExpectedSelectedBottleState,
  concreteBottleUpdateExpectedSharedState,
} from "@peated/server/lib/updateConcreteBottle";
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import {
  MAX_OPERATION_PREVIEW_IDS,
  PreparedBottleMergeDataSchema,
  PreparedBottleUpdateDataSchema,
  type BottleUpdatePreviewSchema,
  type EntityChoicePreviewSchema,
} from "../bottleOperationReviewSchemas";
import {
  bottleRelationshipStates,
  relationshipStateForGroups,
} from "./relationships";
import {
  fail,
  loadEntity,
  relationshipDigest,
  requireInspectedBottle,
  requireInspectedEntity,
  requireNoEntityIdentityCollision,
  resolveLocation,
  sameValue,
  sortedRoles,
  sortedUnique,
  type ParsedPreparationContext,
  type PreparedOperationExecution,
} from "./shared";

type ResolvedEntityChoice = {
  preview: z.infer<typeof EntityChoicePreviewSchema>;
  canonical: number | Record<string, unknown>;
  dependency: {
    entityId: number;
    name: string;
    shortName: string | null;
    roles: Entity["type"];
  } | null;
};

async function resolveEntityChoice({
  choice,
  requiredRole,
  context,
}: {
  choice: BottleOperationEntityChoice;
  requiredRole: Entity["type"][number];
  context: ParsedPreparationContext;
}): Promise<ResolvedEntityChoice> {
  if (choice.kind === "existing") {
    requireInspectedEntity(choice.entityId, context);
    const current = await loadEntity(context.database, choice.entityId);
    if (!current.entity.type.includes(requiredRole)) {
      fail(
        "invalid_current_state",
        `Entity ${choice.entityId} does not have the ${requiredRole} role.`,
      );
    }
    const dependency = {
      entityId: current.entity.id,
      name: current.entity.name,
      shortName: current.entity.shortName,
      roles: [...current.entity.type].sort() as Entity["type"],
    };
    return {
      preview: {
        kind: "existing",
        ...dependency,
      },
      canonical: current.entity.id,
      dependency,
    };
  }

  if (!choice.entity.roles.includes(requiredRole)) {
    fail(
      "invalid_current_state",
      `New ${requiredRole} draft does not include the ${requiredRole} role.`,
    );
  }
  const normalizedName = normalizeEntityName(choice.entity.name);
  const normalizedDraft = {
    ...choice.entity,
    name: normalizedName,
    roles: sortedRoles(choice.entity.roles),
  };
  await requireNoEntityIdentityCollision({
    entityId: null,
    names: [
      normalizedDraft.name,
      normalizedDraft.shortName,
      normalizedDraft.name.startsWith("The ")
        ? normalizedDraft.name.substring(4)
        : null,
    ],
    database: context.database,
  });
  const location = await resolveLocation({
    countryName: normalizedDraft.country,
    regionName: normalizedDraft.region,
    database: context.database,
  });
  const canonical = {
    id: null,
    name: normalizedDraft.name,
    shortName: normalizedDraft.shortName,
    type: normalizedDraft.roles,
    website: normalizedDraft.website,
    country: location.country?.id ?? null,
    region: location.region?.id ?? null,
    yearEstablished: normalizedDraft.yearEstablished,
  };
  return {
    preview: {
      kind: "create",
      entity: normalizedDraft,
      location: {
        country: location.country,
        region: location.region
          ? { id: location.region.id, name: location.region.name }
          : null,
      },
    },
    canonical,
    dependency: null,
  };
}

function resolvedEntityChoiceKey(choice: ResolvedEntityChoice): string {
  if (typeof choice.canonical === "number") {
    return `existing:${choice.canonical}`;
  }
  return `create:${JSON.stringify(choice.canonical)}`;
}

function normalizeResolvedEntityChoices(
  choices: readonly ResolvedEntityChoice[],
) {
  return Array.from(
    new Map(
      choices.map((choice) => [resolvedEntityChoiceKey(choice), choice]),
    ).values(),
  ).sort((left, right) => {
    if (
      typeof left.canonical === "number" &&
      typeof right.canonical === "number"
    ) {
      return left.canonical - right.canonical;
    }
    if (typeof left.canonical === "number") return -1;
    if (typeof right.canonical === "number") return 1;
    return resolvedEntityChoiceKey(left).localeCompare(
      resolvedEntityChoiceKey(right),
    );
  });
}

type BottleResource = {
  bottle: Bottle;
  group: BottleGroup;
  brand: Entity;
  bottler: Entity | null;
  series: BottleSeries | null;
  distillerIds: number[];
  distillers: Entity[];
  aliases: string[];
  tombstoneDestinationBottleId: number | null;
};

async function loadBottle(
  database: AnyDatabase,
  bottleId: number,
): Promise<BottleResource> {
  const [bottle] = await database
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1);
  if (!bottle) {
    fail("resource_not_found", `Bottle ${bottleId} does not exist.`);
  }
  if (!bottle.groupId) {
    fail(
      "invalid_current_state",
      `Bottle ${bottleId} does not have an active BottleGroup.`,
    );
  }
  const [group] = await database
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, bottle.groupId))
    .limit(1);
  if (
    !group ||
    group.representativeBottleId === null ||
    group.brandId !== bottle.brandId
  ) {
    fail(
      "invalid_current_state",
      `Bottle ${bottleId} has an invalid BottleGroup relationship.`,
    );
  }
  const brand = (await loadEntity(database, group.brandId)).entity;
  const bottler = group.bottlerId
    ? (await loadEntity(database, group.bottlerId)).entity
    : null;
  const series = group.seriesId
    ? ((
        await database
          .select()
          .from(bottleSeries)
          .where(eq(bottleSeries.id, group.seriesId))
          .limit(1)
      )[0] ?? null)
    : null;
  if (group.seriesId && !series) {
    fail(
      "invalid_current_state",
      `BottleGroup ${group.id} references missing series ${group.seriesId}.`,
    );
  }
  const distillerRows = await database
    .select({ entity: entities })
    .from(bottleGroupDistillers)
    .innerJoin(entities, eq(entities.id, bottleGroupDistillers.distillerId))
    .where(eq(bottleGroupDistillers.groupId, group.id))
    .orderBy(asc(entities.id));
  const aliases = await database
    .select({ name: bottleAliases.name })
    .from(bottleAliases)
    .where(eq(bottleAliases.bottleId, bottle.id))
    .orderBy(asc(bottleAliases.name));
  const [tombstone] = await database
    .select({ newBottleId: bottleTombstones.newBottleId })
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottle.id))
    .limit(1);
  if (tombstone) {
    fail("invalid_current_state", `Bottle ${bottle.id} is already retired.`);
  }

  return {
    bottle,
    group,
    brand,
    bottler,
    series,
    distillerIds: distillerRows.map(({ entity }) => entity.id),
    distillers: distillerRows.map(({ entity }) => entity),
    aliases: aliases.map(({ name }) => name),
    tombstoneDestinationBottleId: null,
  };
}

function existingEntityChoice(entity: Entity) {
  return {
    kind: "existing" as const,
    entityId: entity.id,
    name: entity.name,
    shortName: entity.shortName,
    roles: [...entity.type].sort(),
  };
}

function bottleExact(resource: BottleResource): ConcreteBottleExactIdentity {
  return getConcreteBottleExactIdentity({
    bottle: resource.bottle,
    sourceGroupStatedAge: resource.group.statedAge,
  });
}

function bottlePreviewState(resource: BottleResource) {
  return {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    fullName: resource.bottle.fullName,
    shared: {
      name: resource.group.name,
      statedAge: resource.group.statedAge,
      seriesId: resource.group.seriesId,
      category: resource.group.category,
      brand: existingEntityChoice(resource.brand),
      distillers: resource.distillers.map(existingEntityChoice),
      bottler: resource.bottler ? existingEntityChoice(resource.bottler) : null,
    },
    exact: bottleExact(resource),
  };
}

function bottleMergeIdentityState(resource: BottleResource) {
  return {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    fullName: resource.bottle.fullName,
    shared: {
      name: resource.group.name,
      statedAge: resource.group.statedAge,
      seriesId: resource.group.seriesId,
      category: resource.group.category,
      brandId: resource.group.brandId,
      distillerIds: resource.distillerIds,
      bottlerId: resource.group.bottlerId,
    },
    exact: bottleExact(resource),
    aliasDigest: relationshipDigest(resource.aliases),
    tombstoneDestinationBottleId: resource.tombstoneDestinationBottleId,
  };
}

async function boundedGroupMembers(database: AnyDatabase, groupId: number) {
  const totalRow = await database
    .select({ total: count() })
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .then(([row]) => row);
  const rows = await database
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(asc(bottles.id))
    .limit(MAX_OPERATION_PREVIEW_IDS);
  const total = totalRow?.total ?? 0;
  return {
    total,
    sampleIds: rows.map(({ id }) => id),
    truncated: total > rows.length,
  };
}

async function groupBottles(database: AnyDatabase, groupId: number) {
  return database
    .select()
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(asc(bottles.id));
}

function collectChangedBottleFields(
  before: z.infer<typeof BottleUpdatePreviewSchema>["before"],
  after: z.infer<typeof BottleUpdatePreviewSchema>["after"],
) {
  const changedFields: string[] = [];
  for (const field of [
    "name",
    "statedAge",
    "seriesId",
    "category",
    "brand",
    "distillers",
    "bottler",
  ] as const) {
    if (!sameValue(before.shared[field], after.shared[field])) {
      changedFields.push(`shared.${field}`);
    }
  }
  for (const field of [
    "edition",
    "statedAge",
    "abv",
    "singleCask",
    "caskStrength",
    "vintageYear",
    "releaseYear",
    "caskSize",
    "caskType",
    "caskFill",
  ] as const) {
    if (!sameValue(before.exact[field], after.exact[field])) {
      changedFields.push(`exact.${field}`);
    }
  }
  return changedFields;
}

function relevantBottleUpdateToken({
  resource,
  proposal,
  referencedEntities,
  referencedSeries,
  relationshipDigest: relatedMemberships,
}: {
  resource: BottleResource;
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>;
  referencedEntities: Array<{
    entityId: number;
    name: string;
    shortName: string | null;
    roles: Entity["type"];
  }>;
  referencedSeries: BottleSeries[];
  relationshipDigest?: string;
}) {
  const sharedFields = proposal.input.patch.shared
    ? new Set(Object.keys(proposal.input.patch.shared))
    : null;
  if (sharedFields?.has("name")) {
    sharedFields.add("statedAge");
  }
  const shared = sharedFields
    ? Object.fromEntries(
        [...sharedFields].map((field) => {
          switch (field) {
            case "brand":
              return ["brandId", resource.group.brandId];
            case "distillers":
              return ["distillerIds", resource.distillerIds];
            case "bottler":
              return ["bottlerId", resource.group.bottlerId];
            case "seriesId":
              return ["seriesId", resource.group.seriesId];
            default:
              return [
                field,
                resource.group[field as "name" | "statedAge" | "category"],
              ];
          }
        }),
      )
    : undefined;
  const currentExact = bottleExact(resource);
  const exact = proposal.input.patch.exact
    ? Object.fromEntries(
        Object.keys(proposal.input.patch.exact).map((field) => [
          field,
          currentExact[field as keyof typeof currentExact],
        ]),
      )
    : undefined;

  return {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    ...(shared ? { shared } : {}),
    ...(exact ? { exact } : {}),
    referencedEntities: Array.from(
      new Map(
        referencedEntities.map((entity) => [entity.entityId, entity]),
      ).values(),
    )
      .sort((left, right) => left.entityId - right.entityId)
      .map((entity) => ({ ...entity, roles: sortedRoles(entity.roles) })),
    referencedSeries: referencedSeries
      .sort((left, right) => left.id - right.id)
      .map((series) => ({
        seriesId: series.id,
        brandId: series.brandId,
        name: series.name,
      })),
    ...(relatedMemberships ? { relationshipDigest: relatedMemberships } : {}),
  };
}

async function requireNoBottleIdentityCollision({
  database,
  desiredFullName,
  allowedBottleIds,
}: {
  database: AnyDatabase;
  desiredFullName: string;
  allowedBottleIds: readonly number[];
}) {
  const [bottleCollision] = await database
    .select({ bottleId: bottles.id })
    .from(bottles)
    .where(
      and(
        eq(sql`LOWER(${bottles.fullName})`, desiredFullName.toLowerCase()),
        allowedBottleIds.length
          ? sql`${bottles.id} NOT IN (${sql.join(
              allowedBottleIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : undefined,
      ),
    )
    .limit(1);
  if (bottleCollision) {
    fail(
      "identity_collision",
      `Bottle identity "${desiredFullName}" is already assigned to Bottle ${bottleCollision.bottleId}.`,
    );
  }
  const [aliasCollision] = await database
    .select({ bottleId: bottleAliases.bottleId })
    .from(bottleAliases)
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, desiredFullName.toLowerCase()),
        allowedBottleIds.length
          ? or(
              sql`${bottleAliases.bottleId} IS NULL`,
              sql`${bottleAliases.bottleId} NOT IN (${sql.join(
                allowedBottleIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
          : undefined,
      ),
    )
    .limit(1);
  if (aliasCollision) {
    fail(
      "identity_collision",
      `Bottle identity "${desiredFullName}" conflicts with an existing alias.`,
    );
  }
}

export async function prepareBottleUpdate(
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>,
  context: ParsedPreparationContext,
): Promise<Extract<PreparedOperationExecution, { type: "update_bottle" }>> {
  requireInspectedBottle(proposal.input.bottleId, context);
  const resource = await loadBottle(context.database, proposal.input.bottleId);
  const before = bottlePreviewState(resource);
  const referencedEntities: NonNullable<
    ReturnType<typeof relevantBottleUpdateToken>["referencedEntities"]
  > = [];
  const entityCreations: Array<
    Extract<z.infer<typeof EntityChoicePreviewSchema>, { kind: "create" }>
  > = [];

  let brand: ResolvedEntityChoice = {
    preview: before.shared.brand,
    canonical: resource.group.brandId as number | Record<string, unknown>,
    dependency: {
      entityId: resource.brand.id,
      name: resource.brand.name,
      shortName: resource.brand.shortName,
      roles: sortedRoles(resource.brand.type),
    },
  };
  if (proposal.input.patch.shared?.brand) {
    brand = await resolveEntityChoice({
      choice: proposal.input.patch.shared.brand,
      requiredRole: "brand",
      context,
    });
  }
  if (brand.dependency && proposal.input.patch.shared !== undefined) {
    referencedEntities.push(brand.dependency);
  }
  if (brand.preview.kind === "create") entityCreations.push(brand.preview);

  let bottler:
    | ResolvedEntityChoice
    | {
        preview: null;
        canonical: null;
        dependency: null;
      };
  if (proposal.input.patch.shared?.bottler === null) {
    bottler = { preview: null, canonical: null, dependency: null };
  } else if (proposal.input.patch.shared?.bottler) {
    bottler = await resolveEntityChoice({
      choice: proposal.input.patch.shared.bottler,
      requiredRole: "bottler",
      context,
    });
  } else if (resource.bottler) {
    bottler = {
      preview: existingEntityChoice(resource.bottler),
      canonical: resource.bottler.id,
      dependency: {
        entityId: resource.bottler.id,
        name: resource.bottler.name,
        shortName: resource.bottler.shortName,
        roles: sortedRoles(resource.bottler.type),
      },
    };
  } else {
    bottler = { preview: null, canonical: null, dependency: null };
  }
  if (
    bottler.dependency &&
    proposal.input.patch.shared?.bottler !== undefined
  ) {
    referencedEntities.push(bottler.dependency);
  }
  if (bottler.preview?.kind === "create") {
    entityCreations.push(bottler.preview);
  }

  const proposedDistillers: ResolvedEntityChoice[] = [];
  if (proposal.input.patch.shared?.distillers) {
    for (const choice of proposal.input.patch.shared.distillers) {
      proposedDistillers.push(
        await resolveEntityChoice({
          choice,
          requiredRole: "distiller",
          context,
        }),
      );
    }
  } else {
    for (const distiller of resource.distillers) {
      proposedDistillers.push({
        preview: existingEntityChoice(distiller),
        canonical: distiller.id,
        dependency: {
          entityId: distiller.id,
          name: distiller.name,
          shortName: distiller.shortName,
          roles: sortedRoles(distiller.type),
        },
      });
    }
  }
  const distillers = normalizeResolvedEntityChoices(proposedDistillers);
  for (const distiller of distillers) {
    if (
      distiller.dependency &&
      proposal.input.patch.shared?.distillers !== undefined
    ) {
      referencedEntities.push(distiller.dependency);
    }
    if (distiller.preview.kind === "create") {
      entityCreations.push(distiller.preview);
    }
  }

  const referencedSeries: BottleSeries[] = [];
  let seriesId = resource.group.seriesId;
  const seriesTouched = proposal.input.patch.shared?.seriesId !== undefined;
  const brandTouched = proposal.input.patch.shared?.brand !== undefined;
  if (seriesTouched || brandTouched) {
    if (seriesTouched) {
      seriesId = proposal.input.patch.shared?.seriesId ?? null;
    }
    if (seriesId !== null) {
      if (seriesTouched && !context.inspectedSeriesIds.has(seriesId)) {
        fail(
          "target_not_inspected",
          `BottleSeries ${seriesId} was not inspected by this Bottle check.`,
        );
      }
      const series =
        !seriesTouched && resource.series?.id === seriesId
          ? resource.series
          : await context.database
              .select()
              .from(bottleSeries)
              .where(eq(bottleSeries.id, seriesId))
              .limit(1)
              .then(([row]) => row);
      if (!series) {
        fail("resource_not_found", `BottleSeries ${seriesId} does not exist.`);
      }
      referencedSeries.push(series);
      const brandId =
        typeof brand.canonical === "number" ? brand.canonical : null;
      if (brandId !== null && series.brandId !== brandId) {
        fail(
          "invalid_current_state",
          `BottleSeries ${series.id} does not belong to Brand ${brandId}.`,
        );
      }
      if (brandId === null) {
        fail(
          "invalid_current_state",
          "A new Brand cannot be paired with an existing BottleSeries.",
        );
      }
    }
  }

  const canonicalSharedPatch = proposal.input.patch.shared
    ? { ...proposal.input.patch.shared }
    : undefined;
  if (canonicalSharedPatch) {
    delete canonicalSharedPatch.seriesId;
    delete canonicalSharedPatch.brand;
    delete canonicalSharedPatch.bottler;
    delete canonicalSharedPatch.distillers;
  }
  const canonicalInput: ConcreteBottleUpdateInput =
    ConcreteBottleUpdateInputSchema.parse({
      ...(proposal.input.patch.shared
        ? {
            shared: {
              ...canonicalSharedPatch,
              ...(proposal.input.patch.shared.seriesId !== undefined
                ? { series: seriesId }
                : {}),
              ...(proposal.input.patch.shared.brand !== undefined
                ? { brand: brand.canonical }
                : {}),
              ...(proposal.input.patch.shared.bottler !== undefined
                ? { bottler: bottler.canonical }
                : {}),
              ...(proposal.input.patch.shared.distillers !== undefined
                ? {
                    distillers: distillers.map(({ canonical }) => canonical),
                  }
                : {}),
            },
          }
        : {}),
      ...(proposal.input.patch.exact
        ? { exact: proposal.input.patch.exact }
        : {}),
    });

  let sharedName =
    canonicalInput.shared?.name === undefined
      ? resource.group.name
      : canonicalInput.shared.name;
  let sharedStatedAge =
    canonicalInput.shared?.statedAge === undefined
      ? resource.group.statedAge
      : canonicalInput.shared.statedAge;
  if (canonicalInput.shared?.name !== undefined) {
    const normalized = normalizeBottleAge({
      name: normalizeBottleAliasKey(canonicalInput.shared.name),
      statedAge: sharedStatedAge,
    });
    sharedName = normalized.name;
    if (canonicalInput.shared.statedAge === undefined) {
      sharedStatedAge = normalized.statedAge;
    }
  }
  const brandName =
    brand.preview.kind === "existing"
      ? brand.preview.name
      : brand.preview.entity.name;
  const brandShortName =
    brand.preview.kind === "existing"
      ? brand.preview.shortName
      : brand.preview.entity.shortName;
  sharedName = stripDuplicateBrandPrefixFromBottleName(sharedName, brandName);
  if (!sharedName || bottleNameDuplicatesBrand(sharedName, brandName)) {
    fail(
      "invalid_current_state",
      "Bottle name must identify an expression distinct from the Brand.",
    );
  }
  const stableFullName = formatBottleName({
    name: `${brandShortName || brandName} ${sharedName}`,
  });
  const exactAfter = getConcreteBottleExactIdentity({
    bottle: resource.bottle,
    sourceGroupStatedAge: resource.group.statedAge,
    exactPatch: canonicalInput.exact,
  });
  const materialized = materializeConcreteBottleIdentity({
    stable: {
      name: sharedName,
      fullName: stableFullName,
      statedAge: sharedStatedAge,
    },
    exact: exactAfter,
  });
  const after = {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    fullName: materialized.fullName,
    shared: {
      name: sharedName,
      statedAge: sharedStatedAge,
      seriesId,
      category:
        canonicalInput.shared?.category === undefined
          ? resource.group.category
          : canonicalInput.shared.category,
      brand: brand.preview,
      distillers: distillers.map(({ preview }) => preview),
      bottler: bottler.preview,
    },
    exact: exactAfter,
  };
  const changedFields = collectChangedBottleFields(before, after);
  if (changedFields.length === 0 && entityCreations.length === 0) {
    fail(
      "no_changes",
      `Bottle ${resource.bottle.id} already has the proposed state.`,
    );
  }

  const sharedChanged = changedFields.some((field) =>
    field.startsWith("shared."),
  );
  if (sharedChanged) {
    const members = await groupBottles(context.database, resource.group.id);
    const memberIds = members.map(({ id: bottleId }) => bottleId);
    const desiredNames = new Set<string>();
    for (const member of members) {
      const desired =
        member.id === resource.bottle.id
          ? after
          : materializeConcreteBottleIdentity({
              stable: {
                name: sharedName,
                fullName: stableFullName,
                statedAge: sharedStatedAge,
              },
              exact: getConcreteBottleExactIdentity({
                bottle: member,
                sourceGroupStatedAge: resource.group.statedAge,
              }),
            });
      const identityKey = desired.fullName.toLowerCase();
      if (desiredNames.has(identityKey)) {
        fail(
          "identity_collision",
          `BottleGroup ${resource.group.id} would contain duplicate Bottle identity "${desired.fullName}".`,
        );
      }
      desiredNames.add(identityKey);
      await requireNoBottleIdentityCollision({
        database: context.database,
        desiredFullName: desired.fullName,
        allowedBottleIds: memberIds,
      });
    }
  } else {
    await requireNoBottleIdentityCollision({
      database: context.database,
      desiredFullName: after.fullName,
      allowedBottleIds: [resource.bottle.id],
    });
  }

  const affectedBottles = sharedChanged
    ? await boundedGroupMembers(context.database, resource.group.id)
    : {
        total: 1,
        sampleIds: [resource.bottle.id],
        truncated: false,
      };
  const warnings = [
    ...(sharedChanged && affectedBottles.total > 1
      ? [
          {
            code: "shared_group_fan_out" as const,
            message: `Shared fields will rematerialize ${affectedBottles.total} Bottles in BottleGroup ${resource.group.id}.`,
          },
        ]
      : []),
    ...entityCreations.map(() => ({
      code: "creates_entity" as const,
      message: "This Bottle update will create a related Entity.",
    })),
  ];

  return {
    type: proposal.type,
    review: PreparedBottleUpdateDataSchema.parse({
      type: proposal.type,
      proposal,
      preview: {
        before,
        after,
        changedFields,
        affectedBottles,
        entityCreations,
        warnings,
      },
      stateToken: relevantBottleUpdateToken({
        resource,
        proposal,
        referencedEntities,
        referencedSeries,
        relationshipDigest: proposal.input.patch.shared
          ? relationshipDigest(
              await relationshipStateForGroups(context.database, [
                resource.group.id,
              ]),
            )
          : undefined,
      }),
    }),
    canonicalInput: {
      bottleId: proposal.input.bottleId,
      input: canonicalInput,
      expectedSelectedBottleState:
        concreteBottleUpdateExpectedSelectedBottleState(resource.bottle),
      ...(proposal.input.patch.shared
        ? {
            expectedSharedState: concreteBottleUpdateExpectedSharedState({
              group: resource.group,
              distillerIds: resource.distillerIds,
              referencedEntities: referencedEntities.map(
                ({ entityId: id, name, shortName, roles: type }) => ({
                  id,
                  name,
                  shortName,
                  type,
                }),
              ),
              series: resource.series,
              referencedSeries,
            }),
          }
        : {}),
    },
  };
}

async function bottleMergeConsumerPreview(
  database: AnyDatabase,
  sourceBottleId: number,
  destinationBottleId: number,
) {
  const tastingCount = await database
    .select({ total: count() })
    .from(tastings)
    .where(eq(tastings.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const reviewCount = await database
    .select({ total: count() })
    .from(reviews)
    .where(eq(reviews.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const storePriceCount = await database
    .select({ total: count() })
    .from(storePrices)
    .where(eq(storePrices.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const observationCount = await database
    .select({ total: count() })
    .from(bottleObservations)
    .where(eq(bottleObservations.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const collectionCount = await database
    .select({ total: count() })
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const flightCount = await database
    .select({ total: count() })
    .from(flightBottles)
    .where(eq(flightBottles.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const aliasCount = await database
    .select({ total: count() })
    .from(bottleAliases)
    .where(eq(bottleAliases.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const collectionCollisions = await database
    .select({
      total: countDistinct(collectionBottles.collectionId),
    })
    .from(collectionBottles)
    .where(
      and(
        eq(collectionBottles.bottleId, sourceBottleId),
        sql`EXISTS (
            SELECT 1
            FROM collection_bottle destination_membership
            WHERE destination_membership.collection_id = ${collectionBottles.collectionId}
              AND destination_membership.bottle_id = ${destinationBottleId}
          )`,
      ),
    )
    .then(([row]) => row?.total ?? 0);
  const flightCollisions = await database
    .select({ total: countDistinct(flightBottles.flightId) })
    .from(flightBottles)
    .where(
      and(
        eq(flightBottles.bottleId, sourceBottleId),
        sql`EXISTS (
            SELECT 1
            FROM flight_bottle destination_membership
            WHERE destination_membership.flight_id = ${flightBottles.flightId}
              AND destination_membership.bottle_id = ${destinationBottleId}
          )`,
      ),
    )
    .then(([row]) => row?.total ?? 0);
  const tastingCollisions = await database
    .select({ total: count() })
    .from(tastings)
    .where(
      and(
        eq(tastings.bottleId, sourceBottleId),
        sql`EXISTS (
            SELECT 1
            FROM tasting destination_tasting
            WHERE destination_tasting.bottle_id = ${destinationBottleId}
              AND destination_tasting.created_by_id = ${tastings.createdById}
              AND destination_tasting.created_at = ${tastings.createdAt}
          )`,
      ),
    )
    .then(([row]) => row?.total ?? 0);
  if (tastingCollisions > 0) {
    fail(
      "direct_conflict",
      "Bottle merge would violate an existing tasting identity.",
    );
  }
  return {
    consumers: {
      tastings: tastingCount,
      reviews: reviewCount,
      storePrices: storePriceCount,
      observations: observationCount,
      collectionMemberships: collectionCount,
      flightMemberships: flightCount,
      aliases: aliasCount,
    },
    membershipCollisions: {
      collections: collectionCollisions,
      flights: flightCollisions,
    },
  };
}

async function bottleMergeRelationshipState(
  database: AnyDatabase,
  source: BottleResource,
  destination: BottleResource,
) {
  const bottleIds = [source.bottle.id, destination.bottle.id];
  const groupIds = sortedUnique([source.group.id, destination.group.id]);
  const bottleGroupsState = await relationshipStateForGroups(
    database,
    groupIds,
  );
  const memberBottleIds = await database
    .select({ bottleId: bottles.id })
    .from(bottles)
    .where(inArray(bottles.groupId, groupIds))
    .orderBy(asc(bottles.id))
    .then((rows) => rows.map(({ bottleId }) => bottleId));
  const bottleStates = await bottleRelationshipStates(
    database,
    memberBottleIds,
  );
  const tastingRows = await database
    .select({ id: tastings.id })
    .from(tastings)
    .where(inArray(tastings.bottleId, bottleIds))
    .orderBy(asc(tastings.id));
  const reviewRows = await database
    .select({ id: reviews.id })
    .from(reviews)
    .where(inArray(reviews.bottleId, bottleIds))
    .orderBy(asc(reviews.id));
  const storePriceRows = await database
    .select({ id: storePrices.id })
    .from(storePrices)
    .where(inArray(storePrices.bottleId, bottleIds))
    .orderBy(asc(storePrices.id));
  const observationRows = await database
    .select({ id: bottleObservations.id })
    .from(bottleObservations)
    .where(inArray(bottleObservations.bottleId, bottleIds))
    .orderBy(asc(bottleObservations.id));
  const decisionLogRows = await database
    .select({ id: incomingBottleDecisionLogs.id })
    .from(incomingBottleDecisionLogs)
    .where(inArray(incomingBottleDecisionLogs.bottleId, bottleIds))
    .orderBy(asc(incomingBottleDecisionLogs.id));
  const collectionRows = await database
    .select({
      membershipId: collectionBottles.id,
      collectionId: collectionBottles.collectionId,
      bottleId: collectionBottles.bottleId,
    })
    .from(collectionBottles)
    .where(inArray(collectionBottles.bottleId, bottleIds))
    .orderBy(asc(collectionBottles.collectionId), asc(collectionBottles.id));
  const flightRows = await database
    .select({
      flightId: flightBottles.flightId,
      bottleId: flightBottles.bottleId,
    })
    .from(flightBottles)
    .where(inArray(flightBottles.bottleId, bottleIds))
    .orderBy(asc(flightBottles.flightId), asc(flightBottles.bottleId));
  const matchProposalRows = await database
    .select({
      proposalId: storePriceMatchProposals.id,
      currentBottleId: storePriceMatchProposals.currentBottleId,
      suggestedBottleId: storePriceMatchProposals.suggestedBottleId,
    })
    .from(storePriceMatchProposals)
    .where(
      or(
        inArray(storePriceMatchProposals.currentBottleId, bottleIds),
        inArray(storePriceMatchProposals.suggestedBottleId, bottleIds),
      ),
    )
    .orderBy(asc(storePriceMatchProposals.id));
  const matchAttemptRows = await database
    .select({
      attemptId: storePriceMatchAttempts.id,
      currentBottleId: storePriceMatchAttempts.currentBottleId,
      suggestedBottleId: storePriceMatchAttempts.suggestedBottleId,
    })
    .from(storePriceMatchAttempts)
    .where(
      or(
        inArray(storePriceMatchAttempts.currentBottleId, bottleIds),
        inArray(storePriceMatchAttempts.suggestedBottleId, bottleIds),
      ),
    )
    .orderBy(asc(storePriceMatchAttempts.id));
  const tagRows = await database
    .select({ bottleId: bottleTags.bottleId, tag: bottleTags.tag })
    .from(bottleTags)
    .where(inArray(bottleTags.bottleId, bottleIds))
    .orderBy(asc(bottleTags.bottleId), asc(bottleTags.tag));
  const flavorRows = await database
    .select({
      bottleId: bottleFlavorProfiles.bottleId,
      flavorProfile: bottleFlavorProfiles.flavorProfile,
    })
    .from(bottleFlavorProfiles)
    .where(inArray(bottleFlavorProfiles.bottleId, bottleIds))
    .orderBy(
      asc(bottleFlavorProfiles.bottleId),
      asc(bottleFlavorProfiles.flavorProfile),
    );
  const tombstoneRows = await database
    .select({
      bottleId: bottleTombstones.bottleId,
      destinationBottleId: bottleTombstones.newBottleId,
    })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.newBottleId, bottleIds))
    .orderBy(asc(bottleTombstones.bottleId));
  return {
    bottleGroups: bottleGroupsState,
    bottles: bottleStates,
    tastingIds: tastingRows.map(({ id }) => id),
    reviewIds: reviewRows.map(({ id }) => id),
    storePriceIds: storePriceRows.map(({ id }) => id),
    observationIds: observationRows.map(({ id }) => id),
    incomingDecisionLogIds: decisionLogRows.map(({ id }) => id),
    collectionMemberships: collectionRows,
    flightMemberships: flightRows,
    matchProposals: matchProposalRows,
    matchAttempts: matchAttemptRows,
    tags: tagRows,
    flavorProfiles: flavorRows,
    incomingTombstones: tombstoneRows.filter(
      (
        row,
      ): row is {
        bottleId: number;
        destinationBottleId: number;
      } => row.destinationBottleId !== null,
    ),
  };
}

export async function prepareBottleMerge(
  proposal: Extract<ProposedOperation, { type: "merge_bottles" }>,
  context: ParsedPreparationContext,
): Promise<Extract<PreparedOperationExecution, { type: "merge_bottles" }>> {
  const { sourceBottleId, destinationBottleId } = proposal.input;
  requireInspectedBottle(sourceBottleId, context);
  requireInspectedBottle(destinationBottleId, context);
  if (context.protectedBottleIds.has(sourceBottleId)) {
    fail(
      "direct_conflict",
      `Bottle ${sourceBottleId} is protected by the primary resolution decision.`,
    );
  }
  const source = await loadBottle(context.database, sourceBottleId);
  const destination = await loadBottle(context.database, destinationBottleId);
  const impact = await bottleMergeConsumerPreview(
    context.database,
    sourceBottleId,
    destinationBottleId,
  );
  const relationships = await bottleMergeRelationshipState(
    context.database,
    source,
    destination,
  );
  const collisionTotal =
    impact.membershipCollisions.collections +
    impact.membershipCollisions.flights;
  const warnings =
    collisionTotal > 0
      ? [
          {
            code: "consumer_memberships_collapse" as const,
            message: `${collisionTotal} duplicate collection or flight memberships will collapse into the survivor.`,
          },
        ]
      : [];

  return {
    type: proposal.type,
    review: PreparedBottleMergeDataSchema.parse({
      type: proposal.type,
      proposal,
      preview: {
        source: bottlePreviewState(source),
        destination: bottlePreviewState(destination),
        outcome: {
          retiredBottleId: sourceBottleId,
          survivorBottleId: destinationBottleId,
          tombstoneDestinationBottleId: destinationBottleId,
        },
        ...impact,
        warnings,
      },
      stateToken: {
        source: bottleMergeIdentityState(source),
        destination: bottleMergeIdentityState(destination),
        relationshipDigest: relationshipDigest(relationships),
      },
    }),
    canonicalInput: {
      sourceBottleId,
      destinationBottleId,
    },
  };
}
