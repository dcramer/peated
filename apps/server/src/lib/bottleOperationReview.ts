import {
  BottleClassificationArtifactsSchema,
  ProposedOperationSchema,
  type EvidenceRef,
  type ProposedEntityChoice,
  type ProposedOperation,
} from "@peated/bottle-classifier";
import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleAliasKey,
  normalizeEntityName,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
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
  bottlesToDistillers,
  bottleTags,
  bottleTombstones,
  collectionBottles,
  countries,
  entities,
  entityAliases,
  entityTombstones,
  flightBottles,
  incomingBottleDecisionLogs,
  regions,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import type { BottleCheckOperationCapabilities } from "@peated/server/lib/bottleCheckAvailableOperations";
import {
  getConcreteBottleExactIdentity,
  materializeConcreteBottleIdentity,
  type ConcreteBottleExactIdentity,
} from "@peated/server/lib/concreteBottleIdentity";
import {
  ConcreteBottleUpdateInputSchema,
  type ConcreteBottleUpdateInput,
} from "@peated/server/lib/concreteBottleSchemas";
import { findEntityByExactNameOrAlias } from "@peated/server/lib/db";
import { formatBottleName } from "@peated/server/lib/format";
import { lockConcreteBottleMergeDependencies } from "@peated/server/lib/mergeConcreteBottles";
import {
  concreteBottleUpdateExpectedSelectedBottleState,
  concreteBottleUpdateExpectedSharedState,
  type ConcreteBottleUpdateExpectedSelectedBottleState,
  type ConcreteBottleUpdateExpectedSharedState,
} from "@peated/server/lib/updateConcreteBottle";
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
  ne,
  or,
  sql,
} from "drizzle-orm";
import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  BlockedProposalSchema,
  BlockedReviewOperationSchema,
  MAX_OPERATION_PREVIEW_IDS,
  PreparedBottleMergeDataSchema,
  PreparedBottleUpdateDataSchema,
  PreparedEntityMergeDataSchema,
  PreparedEntityUpdateDataSchema,
  PreparedProposalSchema,
  PreparedReviewOperationSchema,
  type BottleUpdatePreviewSchema,
  type EntityChoicePreviewSchema,
  type PreparationError,
  type PreparationErrorCode,
  type PreparedProposalResult,
  type PreparedReviewOperation,
  type ReviewOperation,
} from "./bottleOperationReviewSchemas";

type ParsedArtifacts = z.infer<typeof BottleClassificationArtifactsSchema>;
export type BottleOperationRow = {
  id: number;
  proposal: unknown;
};

export type BottleOperationPreparationContext = {
  artifacts: unknown;
  capabilities: BottleCheckOperationCapabilities;
  sourceFields?: readonly string[];
  protectedBottleIds?: readonly number[];
  database?: AnyDatabase;
};

export type BottleOperationExecutionPreparationContext = Omit<
  BottleOperationPreparationContext,
  "database"
> & {
  database: AnyTransaction;
};

export type PreparedOperationExecution =
  | {
      type: "update_bottle";
      review: z.infer<typeof PreparedBottleUpdateDataSchema>;
      canonicalInput: {
        bottleId: number;
        input: ConcreteBottleUpdateInput;
        expectedSelectedBottleState: ConcreteBottleUpdateExpectedSelectedBottleState;
        expectedSharedState?: ConcreteBottleUpdateExpectedSharedState;
      };
    }
  | {
      type: "merge_bottles";
      review: z.infer<typeof PreparedBottleMergeDataSchema>;
      canonicalInput: {
        sourceBottleId: number;
        destinationBottleId: number;
      };
    }
  | {
      type: "update_entity";
      review: z.infer<typeof PreparedEntityUpdateDataSchema>;
      canonicalInput: {
        entityId: number;
        input: EntityUpdateInput;
        expectedState: EntityUpdateExpectedState;
      };
    }
  | {
      type: "merge_entities";
      review: z.infer<typeof PreparedEntityMergeDataSchema>;
      canonicalInput: {
        sourceEntityId: number;
        destinationEntityId: number;
      };
    };

type ParsedPreparationContext = {
  artifacts: ParsedArtifacts;
  capabilities: BottleCheckOperationCapabilities;
  sourceFields: ReadonlySet<string>;
  protectedBottleIds: ReadonlySet<number>;
  database: AnyDatabase;
  collectedBottleIds: ReadonlySet<number>;
  collectedEntityIds: ReadonlySet<number>;
  inspectedBottleIds: ReadonlySet<number>;
  inspectedEntityIds: ReadonlySet<number>;
  inspectedSeriesIds: ReadonlySet<number>;
  webResultUrls: ReadonlySet<string>;
};

class OperationPreparationFailure extends Error {
  constructor(
    readonly code: PreparationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OperationPreparationFailure";
  }

  toJSON(): PreparationError {
    return { code: this.code, message: this.message };
  }
}

export function isOperationPreparationFailure(error: unknown): boolean {
  return error instanceof OperationPreparationFailure;
}

function fail(code: PreparationErrorCode, message: string): never {
  throw new OperationPreparationFailure(code, message);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Bottle operation: ${JSON.stringify(value)}`);
}

function sortedUnique(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function relationshipDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseContext(
  context: BottleOperationPreparationContext,
): ParsedPreparationContext {
  const artifacts = BottleClassificationArtifactsSchema.parse(
    context.artifacts,
  );
  const collectedBottleIds = new Set<number>();
  const collectedEntityIds = new Set<number>();
  for (const candidate of artifacts.candidates) {
    collectedBottleIds.add(candidate.bottleId);
    for (const sibling of candidate.familyContext?.siblingBottles ?? []) {
      collectedBottleIds.add(sibling.bottleId);
    }
  }
  const inspectedSeriesIds = new Set<number>();
  for (const bottleContext of artifacts.bottleContexts) {
    collectedBottleIds.add(bottleContext.bottleId);
    for (const sibling of bottleContext.siblings) {
      collectedBottleIds.add(sibling.bottleId);
    }
    collectedEntityIds.add(bottleContext.shared.brand.entityId);
    for (const distiller of bottleContext.shared.distillers) {
      collectedEntityIds.add(distiller.entityId);
    }
    if (bottleContext.shared.bottler) {
      collectedEntityIds.add(bottleContext.shared.bottler.entityId);
    }
    if (bottleContext.shared.series) {
      inspectedSeriesIds.add(bottleContext.shared.series.seriesId);
    }
  }
  for (const entityContext of artifacts.entityContexts) {
    collectedEntityIds.add(entityContext.entityId);
    for (const bottle of entityContext.relatedBottles) {
      collectedBottleIds.add(bottle.bottleId);
    }
  }
  for (const entity of artifacts.resolvedEntities) {
    collectedEntityIds.add(entity.entityId);
  }

  return {
    artifacts,
    capabilities: context.capabilities,
    sourceFields: new Set(context.sourceFields ?? []),
    protectedBottleIds: new Set(context.protectedBottleIds ?? []),
    database: context.database ?? db,
    collectedBottleIds,
    collectedEntityIds,
    inspectedBottleIds: new Set(
      artifacts.bottleContexts.map(({ bottleId }) => bottleId),
    ),
    inspectedEntityIds: new Set(
      artifacts.entityContexts.map(({ entityId }) => entityId),
    ),
    inspectedSeriesIds,
    webResultUrls: new Set(
      artifacts.searchEvidence.flatMap(({ results }) =>
        results.map(({ url }) => url),
      ),
    ),
  };
}

function evidenceExists(
  evidence: EvidenceRef,
  context: ParsedPreparationContext,
): boolean {
  switch (evidence.kind) {
    case "source":
      return context.sourceFields.has(evidence.field);
    case "bottle":
      return context.collectedBottleIds.has(evidence.bottleId);
    case "entity":
      return context.collectedEntityIds.has(evidence.entityId);
    case "web_result":
      return context.webResultUrls.has(evidence.url);
    default:
      return assertNever(evidence);
  }
}

export function assertCollectedEvidenceRefs({
  artifacts,
  evidenceRefs,
  sourceFields = [],
}: {
  artifacts: unknown;
  evidenceRefs: readonly EvidenceRef[];
  sourceFields?: readonly string[];
}) {
  const context = parseContext({
    artifacts,
    capabilities: {
      update_bottle: false,
      merge_bottles: false,
      update_entity: false,
      merge_entities: false,
    },
    sourceFields,
  });
  const missingEvidence = evidenceRefs.find(
    (reference) => !evidenceExists(reference, context),
  );
  if (missingEvidence) {
    fail(
      "evidence_not_found",
      `Evidence reference was not collected by this Bottle check: ${JSON.stringify(missingEvidence)}.`,
    );
  }
}

function validateEvidence(
  proposal: ProposedOperation,
  context: ParsedPreparationContext,
) {
  const missingEvidence = proposal.evidenceRefs.find(
    (reference) => !evidenceExists(reference, context),
  );
  if (missingEvidence) {
    fail(
      "evidence_not_found",
      `Evidence reference was not collected by this Bottle check: ${JSON.stringify(missingEvidence)}.`,
    );
  }
}

function requireInspectedBottle(
  bottleId: number,
  context: ParsedPreparationContext,
) {
  if (!context.inspectedBottleIds.has(bottleId)) {
    fail(
      "target_not_inspected",
      `Bottle ${bottleId} was not inspected by this Bottle check.`,
    );
  }
}

function requireInspectedEntity(
  entityId: number,
  context: ParsedPreparationContext,
) {
  if (!context.inspectedEntityIds.has(entityId)) {
    fail(
      "target_not_inspected",
      `Entity ${entityId} was not inspected by this Bottle check.`,
    );
  }
}

type EntityWithLocation = {
  entity: Entity;
  country: { id: number; name: string } | null;
  region: { id: number; name: string; countryId: number } | null;
};

async function loadEntity(
  database: AnyDatabase,
  entityId: number,
): Promise<EntityWithLocation> {
  const [row] = await database
    .select({
      entity: entities,
      countryId: countries.id,
      countryName: countries.name,
      regionId: regions.id,
      regionName: regions.name,
      regionCountryId: regions.countryId,
    })
    .from(entities)
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(eq(entities.id, entityId))
    .limit(1);
  if (!row) {
    fail("resource_not_found", `Entity ${entityId} does not exist.`);
  }

  return {
    entity: row.entity,
    country:
      row.countryId && row.countryName
        ? { id: row.countryId, name: row.countryName }
        : null,
    region:
      row.regionId && row.regionName && row.regionCountryId
        ? {
            id: row.regionId,
            name: row.regionName,
            countryId: row.regionCountryId,
          }
        : null,
  };
}

function entityPreviewState({ entity, country, region }: EntityWithLocation) {
  return {
    entityId: entity.id,
    name: entity.name,
    shortName: entity.shortName,
    roles: [...entity.type].sort(),
    website: entity.website,
    location: {
      country,
      region: region ? { id: region.id, name: region.name } : null,
    },
    yearEstablished: entity.yearEstablished,
  };
}

async function resolveLocation({
  countryName,
  regionName,
  database,
}: {
  countryName: string | null | undefined;
  regionName: string | null | undefined;
  database: AnyDatabase;
}) {
  let country: { id: number; name: string } | null = null;
  if (countryName) {
    [country] = await database
      .select({ id: countries.id, name: countries.name })
      .from(countries)
      .where(eq(sql`LOWER(${countries.name})`, countryName.toLowerCase()))
      .limit(1);
    if (!country) {
      fail(
        "resource_not_found",
        `Country "${countryName}" could not be resolved exactly.`,
      );
    }
  }

  let region:
    | { id: number; name: string; countryId: number }
    | null
    | undefined = null;
  if (regionName) {
    if (!country) {
      fail(
        "invalid_current_state",
        `Region "${regionName}" requires an explicitly resolved country.`,
      );
    }
    [region] = await database
      .select({
        id: regions.id,
        name: regions.name,
        countryId: regions.countryId,
      })
      .from(regions)
      .where(
        and(
          eq(regions.countryId, country.id),
          eq(sql`LOWER(${regions.name})`, regionName.toLowerCase()),
        ),
      )
      .limit(1);
    if (!region) {
      fail(
        "resource_not_found",
        `Region "${regionName}" could not be resolved exactly in ${country.name}.`,
      );
    }
  }

  return { country, region: region ?? null };
}

async function requireNoEntityIdentityCollision({
  entityId,
  names,
  database,
}: {
  entityId: number | null;
  names: readonly (string | null | undefined)[];
  database: AnyDatabase;
}) {
  for (const rawName of names) {
    if (!rawName?.trim()) continue;
    const found = await findEntityByExactNameOrAlias(database, rawName);
    if (found && found.id !== entityId) {
      fail(
        "identity_collision",
        `Entity identity "${rawName}" is already assigned to Entity ${found.id}.`,
      );
    }
  }
}

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
  choice: ProposedEntityChoice;
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

function sortedRoles(roles: readonly Entity["type"][number][]) {
  return Array.from(new Set(roles)).sort() as Entity["type"];
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

async function bottleRelationshipStates(
  database: AnyDatabase,
  bottleIds: readonly number[],
) {
  const ids = sortedUnique(bottleIds);
  if (ids.length === 0) return [];
  const bottleRows = await database
    .select({
      bottleId: bottles.id,
      groupId: bottles.groupId,
      brandId: bottles.brandId,
      bottlerId: bottles.bottlerId,
      seriesId: bottles.seriesId,
    })
    .from(bottles)
    .where(inArray(bottles.id, ids))
    .orderBy(asc(bottles.id));
  const distillerRows = await database
    .select({
      bottleId: bottlesToDistillers.bottleId,
      distillerId: bottlesToDistillers.distillerId,
    })
    .from(bottlesToDistillers)
    .where(inArray(bottlesToDistillers.bottleId, ids))
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    );
  const distillersByBottle = new Map<number, number[]>();
  for (const { bottleId, distillerId } of distillerRows) {
    const current = distillersByBottle.get(bottleId) ?? [];
    current.push(distillerId);
    distillersByBottle.set(bottleId, current);
  }
  return bottleRows.map((row) => ({
    ...row,
    distillerIds: distillersByBottle.get(row.bottleId) ?? [],
  }));
}

async function relationshipStateForGroups(
  database: AnyDatabase,
  groupIds: readonly number[],
) {
  const ids = sortedUnique(groupIds);
  if (ids.length === 0) return [];
  const groupRows = await database
    .select({
      groupId: bottleGroups.id,
      brandId: bottleGroups.brandId,
      bottlerId: bottleGroups.bottlerId,
      seriesId: bottleGroups.seriesId,
    })
    .from(bottleGroups)
    .where(inArray(bottleGroups.id, ids))
    .orderBy(asc(bottleGroups.id));
  const memberRows = await database
    .select({ groupId: bottles.groupId, bottleId: bottles.id })
    .from(bottles)
    .where(inArray(bottles.groupId, ids))
    .orderBy(asc(bottles.groupId), asc(bottles.id));
  const distillerRows = await database
    .select({
      groupId: bottleGroupDistillers.groupId,
      distillerId: bottleGroupDistillers.distillerId,
    })
    .from(bottleGroupDistillers)
    .where(inArray(bottleGroupDistillers.groupId, ids))
    .orderBy(
      asc(bottleGroupDistillers.groupId),
      asc(bottleGroupDistillers.distillerId),
    );
  const membersByGroup = new Map<number, number[]>();
  for (const { groupId, bottleId } of memberRows) {
    if (groupId === null) continue;
    const current = membersByGroup.get(groupId) ?? [];
    current.push(bottleId);
    membersByGroup.set(groupId, current);
  }
  const distillersByGroup = new Map<number, number[]>();
  for (const { groupId, distillerId } of distillerRows) {
    const current = distillersByGroup.get(groupId) ?? [];
    current.push(distillerId);
    distillersByGroup.set(groupId, current);
  }
  return groupRows.map((row) => ({
    ...row,
    distillerIds: distillersByGroup.get(row.groupId) ?? [],
    memberBottleIds: membersByGroup.get(row.groupId) ?? [],
  }));
}

async function entityRelationshipState(
  database: AnyDatabase,
  entityIds: readonly number[],
  brandOnly = false,
) {
  const ids = sortedUnique(entityIds);
  if (ids.length === 0) {
    return { groups: [], bottles: [], series: [] };
  }
  const groupRows = await database
    .selectDistinct({ groupId: bottleGroups.id })
    .from(bottleGroups)
    .leftJoin(
      bottleGroupDistillers,
      eq(bottleGroupDistillers.groupId, bottleGroups.id),
    )
    .where(
      brandOnly
        ? inArray(bottleGroups.brandId, ids)
        : or(
            inArray(bottleGroups.brandId, ids),
            inArray(bottleGroups.bottlerId, ids),
            inArray(bottleGroupDistillers.distillerId, ids),
          ),
    )
    .orderBy(asc(bottleGroups.id));
  const legacyBottleRows = brandOnly
    ? []
    : await database
        .selectDistinct({ bottleId: bottles.id })
        .from(bottles)
        .leftJoin(
          bottlesToDistillers,
          eq(bottlesToDistillers.bottleId, bottles.id),
        )
        .where(
          or(
            inArray(bottles.brandId, ids),
            inArray(bottles.bottlerId, ids),
            inArray(bottlesToDistillers.distillerId, ids),
          ),
        )
        .orderBy(asc(bottles.id));
  const groups = await relationshipStateForGroups(
    database,
    groupRows.map(({ groupId }) => groupId),
  );
  const bottleIds = sortedUnique([
    ...groups.flatMap(({ memberBottleIds }) => memberBottleIds),
    ...legacyBottleRows.map(({ bottleId }) => bottleId),
  ]);
  const bottleStates = await bottleRelationshipStates(database, bottleIds);
  const seriesRows = await database
    .select({
      seriesId: bottleSeries.id,
      brandId: bottleSeries.brandId,
    })
    .from(bottleSeries)
    .where(inArray(bottleSeries.brandId, ids))
    .orderBy(asc(bottleSeries.id));
  return { groups, bottles: bottleStates, series: seriesRows };
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

async function prepareBottleUpdate(
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

async function prepareBottleMerge(
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

async function prepareEntityUpdate(
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
        relationshipDigest: relationshipsTouched
          ? relationshipDigest(
              await entityRelationshipState(
                context.database,
                [current.entity.id],
                true,
              ),
            )
          : undefined,
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

function entityMergeState(
  current: EntityWithLocation,
  aliases: string[],
  tombstoneDestinationEntityId: number | null,
) {
  return {
    entityId: current.entity.id,
    name: current.entity.name,
    shortName: current.entity.shortName,
    roles: sortedRoles(current.entity.type),
    website: current.entity.website,
    countryId: current.entity.countryId,
    regionId: current.entity.regionId,
    yearEstablished: current.entity.yearEstablished,
    aliasDigest: relationshipDigest(aliases),
    tombstoneDestinationEntityId,
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
      return materializeConcreteBottleIdentity({
        stable: {
          name: group.name,
          fullName: stableFullName,
          statedAge: group.statedAge,
        },
        exact: getConcreteBottleExactIdentity({
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

async function prepareEntityMerge(
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
        source: entityMergeState(source, sourceAliases, null),
        destination: entityMergeState(destination, destinationAliases, null),
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

function overlappingPatchFields(
  left: Extract<ProposedOperation, { type: "update_bottle" | "update_entity" }>,
  right: Extract<
    ProposedOperation,
    { type: "update_bottle" | "update_entity" }
  >,
) {
  const fields = (operation: typeof left) => {
    if (operation.type === "update_entity") {
      return Object.keys(operation.input.patch);
    }
    return [
      ...Object.keys(operation.input.patch.shared ?? {}).map(
        (field) => `shared.${field}`,
      ),
      ...Object.keys(operation.input.patch.exact ?? {}).map(
        (field) => `exact.${field}`,
      ),
    ];
  };
  const rightFields = new Set(fields(right));
  return fields(left).some((field) => rightFields.has(field));
}

function existingEntityChoices(
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>,
) {
  const shared = proposal.input.patch.shared;
  if (!shared) return [];
  return [shared.brand, shared.bottler, ...(shared.distillers ?? [])].flatMap(
    (choice) => (choice?.kind === "existing" ? [choice.entityId] : []),
  );
}

function overlappingBottleSharedFields(
  left: Extract<ProposedOperation, { type: "update_bottle" }>,
  right: Extract<ProposedOperation, { type: "update_bottle" }>,
) {
  const fields = (
    operation: Extract<ProposedOperation, { type: "update_bottle" }>,
  ) => {
    const result = new Set(Object.keys(operation.input.patch.shared ?? {}));
    if (result.has("name")) result.add("statedAge");
    return result;
  };
  const rightFields = fields(right);
  return [...fields(left)].some((field) => rightFields.has(field));
}

function operationsConflict(
  left: ProposedOperation,
  right: ProposedOperation,
  bottleGroupsByBottleId: ReadonlyMap<number, number>,
): boolean {
  if (sameValue(left, right)) return true;

  if (left.type === "update_bottle" && right.type === "update_bottle") {
    if (
      left.input.bottleId === right.input.bottleId &&
      overlappingPatchFields(left, right)
    ) {
      return true;
    }
    const leftGroupId = bottleGroupsByBottleId.get(left.input.bottleId);
    return (
      leftGroupId !== undefined &&
      leftGroupId === bottleGroupsByBottleId.get(right.input.bottleId) &&
      overlappingBottleSharedFields(left, right)
    );
  }
  if (left.type === "update_entity" && right.type === "update_entity") {
    return (
      left.input.entityId === right.input.entityId &&
      overlappingPatchFields(left, right)
    );
  }
  if (left.type === "merge_bottles" && right.type === "merge_bottles") {
    return [left.input.sourceBottleId, left.input.destinationBottleId].some(
      (id) =>
        [right.input.sourceBottleId, right.input.destinationBottleId].includes(
          id,
        ),
    );
  }
  if (left.type === "merge_entities" && right.type === "merge_entities") {
    return [left.input.sourceEntityId, left.input.destinationEntityId].some(
      (id) =>
        [right.input.sourceEntityId, right.input.destinationEntityId].includes(
          id,
        ),
    );
  }
  if (left.type === "update_bottle" && right.type === "merge_bottles") {
    return left.input.bottleId === right.input.sourceBottleId;
  }
  if (left.type === "merge_bottles" && right.type === "update_bottle") {
    return operationsConflict(right, left, bottleGroupsByBottleId);
  }
  if (left.type === "update_entity" && right.type === "merge_entities") {
    return (
      left.input.entityId === right.input.sourceEntityId ||
      (left.input.entityId === right.input.destinationEntityId &&
        left.input.patch.roles !== undefined)
    );
  }
  if (left.type === "merge_entities" && right.type === "update_entity") {
    return operationsConflict(right, left, bottleGroupsByBottleId);
  }
  if (left.type === "update_bottle" && right.type === "merge_entities") {
    return existingEntityChoices(left).includes(right.input.sourceEntityId);
  }
  if (left.type === "merge_entities" && right.type === "update_bottle") {
    return operationsConflict(right, left, bottleGroupsByBottleId);
  }
  return false;
}

async function conflictIndexes(
  proposals: ProposedOperation[],
  database: AnyDatabase,
) {
  const updateBottleIds = sortedUnique(
    proposals.flatMap((proposal) =>
      proposal.type === "update_bottle" ? [proposal.input.bottleId] : [],
    ),
  );
  const groupRows = updateBottleIds.length
    ? await database
        .select({ bottleId: bottles.id, groupId: bottles.groupId })
        .from(bottles)
        .where(inArray(bottles.id, updateBottleIds))
    : [];
  const bottleGroupsByBottleId = new Map(
    groupRows.flatMap(({ bottleId, groupId }) =>
      groupId === null ? [] : [[bottleId, groupId] as const],
    ),
  );
  const conflicts = new Set<number>();
  for (let left = 0; left < proposals.length; left += 1) {
    for (let right = left + 1; right < proposals.length; right += 1) {
      if (
        operationsConflict(
          proposals[left]!,
          proposals[right]!,
          bottleGroupsByBottleId,
        )
      ) {
        conflicts.add(left);
        conflicts.add(right);
      }
    }
  }
  return conflicts;
}

async function prepareParsedOperation({
  proposal,
  context,
}: {
  proposal: ProposedOperation;
  context: ParsedPreparationContext;
}): Promise<PreparedOperationExecution> {
  if (context.capabilities[proposal.type] !== true) {
    fail(
      "operation_disabled",
      `Operation ${proposal.type} is disabled for this workflow.`,
    );
  }
  validateEvidence(proposal, context);

  switch (proposal.type) {
    case "update_bottle":
      return prepareBottleUpdate(proposal, context);
    case "merge_bottles":
      return prepareBottleMerge(proposal, context);
    case "update_entity":
      return prepareEntityUpdate(proposal, context);
    case "merge_entities":
      return prepareEntityMerge(proposal, context);
    default:
      return assertNever(proposal);
  }
}

type PreparationOutcome =
  | {
      status: "prepared";
      data: PreparedOperationExecution;
    }
  | {
      status: "blocked";
      proposal: ProposedOperation;
      preparationError: PreparationError;
    };

async function prepareParsedProposals(
  proposals: ProposedOperation[],
  context: ParsedPreparationContext,
): Promise<PreparationOutcome[]> {
  const conflicts = await conflictIndexes(proposals, context.database);
  return Promise.all(
    proposals.map(async (proposal, index) => {
      try {
        if (conflicts.has(index)) {
          fail(
            "direct_conflict",
            "Operation directly conflicts with another proposal in this check.",
          );
        }
        return {
          status: "prepared" as const,
          data: await prepareParsedOperation({ proposal, context }),
        };
      } catch (error) {
        if (!(error instanceof OperationPreparationFailure)) throw error;
        return {
          status: "blocked" as const,
          proposal,
          preparationError: error.toJSON(),
        };
      }
    }),
  );
}

/**
 * Rebuilds canonical service input from a persisted proposal and live state.
 * The returned input is server-only and must never be serialized for review.
 */
export async function prepareOperationForExecution({
  operation,
  ...rawContext
}: BottleOperationExecutionPreparationContext & {
  operation: BottleOperationRow;
}): Promise<PreparedOperationExecution> {
  const proposal = ProposedOperationSchema.parse(operation.proposal);
  if (proposal.type === "merge_bottles") {
    await lockConcreteBottleMergeDependencies(
      rawContext.database,
      proposal.input,
    );
  }
  const context = parseContext(rawContext);
  return await prepareParsedOperation({ proposal, context });
}

export async function prepareOperation({
  operation,
  ...rawContext
}: BottleOperationPreparationContext & {
  operation: BottleOperationRow;
}): Promise<ReviewOperation> {
  const context = parseContext(rawContext);
  const proposal = ProposedOperationSchema.parse(operation.proposal);
  try {
    const data = await prepareParsedOperation({ proposal, context });
    return PreparedReviewOperationSchema.parse({
      id: operation.id,
      status: "pending_review",
      ...data.review,
    });
  } catch (error) {
    if (!(error instanceof OperationPreparationFailure)) throw error;
    return BlockedReviewOperationSchema.parse({
      id: operation.id,
      status: "blocked",
      proposal,
      preparationError: error.toJSON(),
    });
  }
}

export async function prepareOperations({
  operations,
  ...rawContext
}: BottleOperationPreparationContext & {
  operations: BottleOperationRow[];
}): Promise<ReviewOperation[]> {
  const context = parseContext(rawContext);
  const seenIds = new Set<number>();
  const parsed = operations.map(({ id, proposal: rawProposal }) => {
    if (!Number.isSafeInteger(id) || id <= 0 || seenIds.has(id)) {
      throw new RangeError("Operation ids must be unique positive integers.");
    }
    seenIds.add(id);
    return { id, proposal: ProposedOperationSchema.parse(rawProposal) };
  });
  const outcomes = await prepareParsedProposals(
    parsed.map(({ proposal }) => proposal),
    context,
  );
  return outcomes.map((outcome, index) => {
    const id = parsed[index]!.id;
    return outcome.status === "prepared"
      ? PreparedReviewOperationSchema.parse({
          id,
          status: "pending_review",
          ...outcome.data.review,
        })
      : BlockedReviewOperationSchema.parse({
          id,
          status: "blocked",
          proposal: outcome.proposal,
          preparationError: outcome.preparationError,
        });
  });
}

export async function prepareProposals({
  proposals: rawProposals,
  ...rawContext
}: BottleOperationPreparationContext & {
  proposals: unknown[];
}): Promise<PreparedProposalResult[]> {
  const context = parseContext(rawContext);
  const proposals = rawProposals.map((proposal) =>
    ProposedOperationSchema.parse(proposal),
  );
  const outcomes = await prepareParsedProposals(proposals, context);
  return outcomes.map((outcome) =>
    outcome.status === "prepared"
      ? PreparedProposalSchema.parse({
          status: "pending_review",
          proposal: outcome.data.review.proposal,
          resolvedEvidenceRefs: outcome.data.review.proposal.evidenceRefs,
          stateToken: outcome.data.review.stateToken,
        })
      : BlockedProposalSchema.parse({
          status: "blocked",
          proposal: outcome.proposal,
          preparationError: outcome.preparationError,
        }),
  );
}

export type {
  PreparedProposalResult,
  ReviewOperation,
} from "./bottleOperationReviewSchemas";
