/**
 * Transactional moderator editing for concrete Bottles. Shared patches fan out
 * durable member Bottle materialization; exact patches remain isolated.
 */
import { ORPCError } from "@orpc/server";
import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleAliasKey,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import type { CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import { db, type AnyTransaction } from "@peated/server/db";
import type {
  Bottle,
  BottleGroup,
  BottleSeries,
  Entity,
  User,
} from "@peated/server/db/schema";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTombstones,
  catalogTargets,
  changes,
  entities,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { processSeries } from "@peated/server/lib/bottleHelpers";
import { queueEntityCreationVerification } from "@peated/server/lib/catalogVerification";
import {
  ConcreteBottleIdentityConflictError,
  reserveConcreteBottleIdentitiesInTransaction,
} from "@peated/server/lib/concreteBottleConflicts";
import {
  getConcreteBottleExactIdentity,
  materializeConcreteBottleForGroup,
} from "@peated/server/lib/concreteBottleIdentity";
import {
  ConcreteBottleUpdateInputSchema,
  type ConcreteBottleUpdateInput,
} from "@peated/server/lib/concreteBottleSchemas";
import { coerceToUpsert, upsertEntity } from "@peated/server/lib/db";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import type { Context } from "@peated/server/orpc/context";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

export { ConcreteBottleUpdateInputSchema } from "@peated/server/lib/concreteBottleSchemas";
export type { ConcreteBottleUpdateInput } from "@peated/server/lib/concreteBottleSchemas";

type SharedPatch = NonNullable<ConcreteBottleUpdateInput["shared"]>;
type ExactPatch = NonNullable<ConcreteBottleUpdateInput["exact"]>;

export class ConcreteBottleUpdateAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to update a concrete Bottle.");
    this.name = "ConcreteBottleUpdateAuthorizationError";
  }
}

export type ConcreteBottleUpdateGraphErrorCode =
  | "not_found"
  | "retired"
  | "missing_group"
  | "invalid_catalog_graph";

export class ConcreteBottleUpdateGraphError extends Error {
  constructor(
    readonly code: ConcreteBottleUpdateGraphErrorCode,
    readonly bottleId: number,
    readonly groupId: number | null = null,
  ) {
    super(`Cannot update Bottle ${bottleId}: ${code}.`);
    this.name = "ConcreteBottleUpdateGraphError";
  }
}

export class ConcreteBottleUpdateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcreteBottleUpdateInputError";
  }
}

export class ConcreteBottleUpdateConflictError extends Error {
  constructor(readonly conflictingBottleId: number | null) {
    super("Concrete Bottle identity conflicts with an existing Bottle.");
    this.name = "ConcreteBottleUpdateConflictError";
  }
}

export class ConcreteBottleUpdateExpectedStateError extends Error {
  constructor(readonly groupId: number) {
    super(`BottleGroup ${groupId} shared authority changed before update.`);
    this.name = "ConcreteBottleUpdateExpectedStateError";
  }
}

export type ConcreteBottleUpdateResult = {
  bottle: Bottle;
  group: BottleGroup;
  changed: boolean;
};

export type ConcreteBottleUpdateFinalizationManifest =
  ConcreteBottleUpdateResult & {
    creationSource: CatalogVerificationCreationSource;
    changedBottleIds: number[];
    changedAliasNames: string[];
    changedEntityIds: number[];
    newEntityIds: number[];
    affectedSeriesIds: number[];
  };

type DesiredBottle = Pick<
  Bottle,
  | "name"
  | "fullName"
  | "statedAge"
  | "brandId"
  | "bottlerId"
  | "seriesId"
  | "category"
  | "flavorProfile"
  | "edition"
  | "abv"
  | "singleCask"
  | "caskStrength"
  | "vintageYear"
  | "releaseYear"
  | "caskSize"
  | "caskType"
  | "caskFill"
  | "description"
  | "descriptionSrc"
  | "imageUrl"
  | "tastingNotes"
>;

type StableState = Pick<
  BottleGroup,
  | "name"
  | "fullName"
  | "statedAge"
  | "brandId"
  | "bottlerId"
  | "seriesId"
  | "category"
  | "flavorProfile"
> & {
  brand: Entity;
  bottler: Entity | null;
  distillerIds: number[];
};

const expectedGroupKeys = [
  "id",
  "name",
  "fullName",
  "statedAge",
  "brandId",
  "bottlerId",
  "seriesId",
  "category",
  "flavorProfile",
  "representativeBottleId",
] as const satisfies ReadonlyArray<keyof BottleGroup>;

type ExpectedSeries = Pick<
  BottleSeries,
  "id" | "brandId" | "name" | "fullName" | "description"
>;

export type ConcreteBottleUpdateExpectedSharedState = {
  group: Pick<BottleGroup, (typeof expectedGroupKeys)[number]>;
  distillerIds: number[];
  series: ExpectedSeries | null;
  referencedSeries: ExpectedSeries[];
};

/** Captures the shared authority a maintenance caller used to plan an edit. */
export function concreteBottleUpdateExpectedSharedState({
  group,
  distillerIds,
  referencedSeries = [],
  series,
}: {
  group: BottleGroup;
  distillerIds: number[];
  referencedSeries?: BottleSeries[];
  series: BottleSeries | null;
}): ConcreteBottleUpdateExpectedSharedState {
  return {
    group: Object.fromEntries(
      expectedGroupKeys.map((key) => [key, group[key]]),
    ) as ConcreteBottleUpdateExpectedSharedState["group"],
    distillerIds: [...distillerIds].sort((left, right) => left - right),
    series: series
      ? {
          id: series.id,
          brandId: series.brandId,
          name: series.name,
          fullName: series.fullName,
          description: series.description,
        }
      : null,
    referencedSeries: referencedSeries.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      fullName: row.fullName,
      description: row.description,
    })),
  };
}

function hasFields(value: object | undefined): boolean {
  return value !== undefined && Object.keys(value).length > 0;
}

const exactIdentityKeys: ReadonlyArray<keyof ExactPatch> = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskType",
  "caskSize",
  "caskFill",
];

function hasExactIdentityFields(patch: ExactPatch | undefined): boolean {
  return patch !== undefined && exactIdentityKeys.some((key) => key in patch);
}

function sameValues(left: readonly number[], right: readonly number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameExpectedSeries(current: BottleSeries, expected: ExpectedSeries) {
  return (
    current.id === expected.id &&
    current.brandId === expected.brandId &&
    current.name === expected.name &&
    current.fullName === expected.fullName &&
    current.description === expected.description
  );
}

function valueOrCurrent<T>(value: T | undefined, current: T): T {
  return value === undefined ? current : value;
}

function desiredBottleFor({
  bottle,
  oldGroupStatedAge,
  stable,
  exactPatch,
  materializeSharedFields,
  regenerateIdentity,
}: {
  bottle: Bottle;
  oldGroupStatedAge: number | null;
  stable: StableState;
  exactPatch?: ExactPatch;
  materializeSharedFields: boolean;
  regenerateIdentity: boolean;
}): DesiredBottle {
  const exact = getConcreteBottleExactIdentity({
    bottle,
    sourceGroupStatedAge: oldGroupStatedAge,
    exactPatch,
  });
  const sharedMaterialization = materializeConcreteBottleForGroup({
    group: stable,
    exact,
  });
  const identity = regenerateIdentity
    ? sharedMaterialization
    : {
        name: bottle.name,
        fullName: bottle.fullName,
        statedAge: bottle.statedAge,
      };
  const description = valueOrCurrent(
    exactPatch?.description,
    bottle.description,
  );
  const descriptionSrc =
    exactPatch?.descriptionSrc !== undefined
      ? exactPatch.descriptionSrc
      : exactPatch?.description !== undefined
        ? description === null
          ? null
          : "user"
        : bottle.descriptionSrc;

  return {
    name: identity.name,
    fullName: identity.fullName,
    statedAge: identity.statedAge,
    brandId: materializeSharedFields
      ? sharedMaterialization.brandId
      : bottle.brandId,
    bottlerId: materializeSharedFields
      ? sharedMaterialization.bottlerId
      : bottle.bottlerId,
    seriesId: materializeSharedFields
      ? sharedMaterialization.seriesId
      : bottle.seriesId,
    category: materializeSharedFields
      ? sharedMaterialization.category
      : bottle.category,
    flavorProfile: materializeSharedFields
      ? sharedMaterialization.flavorProfile
      : bottle.flavorProfile,
    edition: exact.edition,
    abv: exact.abv,
    singleCask: exact.singleCask,
    caskStrength: exact.caskStrength,
    vintageYear: exact.vintageYear,
    releaseYear: exact.releaseYear,
    caskSize: exact.caskSize,
    caskType: exact.caskType,
    caskFill: exact.caskFill,
    description,
    descriptionSrc,
    imageUrl: exactPatch?.image === null ? null : bottle.imageUrl,
    tastingNotes: valueOrCurrent(exactPatch?.tastingNotes, bottle.tastingNotes),
  };
}

const desiredBottleKeys: ReadonlyArray<keyof DesiredBottle> = [
  "name",
  "fullName",
  "statedAge",
  "brandId",
  "bottlerId",
  "seriesId",
  "category",
  "flavorProfile",
  "edition",
  "abv",
  "singleCask",
  "caskStrength",
  "vintageYear",
  "releaseYear",
  "caskSize",
  "caskType",
  "caskFill",
  "description",
  "descriptionSrc",
  "imageUrl",
  "tastingNotes",
];

function bottleDiff(bottle: DesiredBottle, desired: DesiredBottle) {
  const data: Record<string, unknown> = {};
  for (const key of desiredBottleKeys) {
    if (JSON.stringify(bottle[key]) !== JSON.stringify(desired[key])) {
      data[key] = desired[key];
    }
  }
  return data;
}

async function loadEntity(tx: AnyTransaction, entityId: number) {
  const [entity] = await tx
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  if (!entity) {
    throw new ConcreteBottleUpdateInputError(
      `Entity ${entityId} could not be resolved.`,
    );
  }
  return entity;
}

function requireEntityRole(
  entity: Entity,
  role: Entity["type"][number],
  label: string,
) {
  if (!entity.type.includes(role)) {
    throw new ConcreteBottleUpdateInputError(
      `${label} entity ${entity.id} does not have the ${role} role.`,
    );
  }
}

/**
 * Resolves shared state inside the caller's transaction. Object choices may
 * create entities or a series and collect ids needed for post-commit work.
 */
async function resolveStableState(
  tx: AnyTransaction,
  {
    group,
    patch,
    currentDistillerIds,
    actorId,
    user,
    creationSource,
    changedEntityIds,
    newEntityIds,
  }: {
    group: BottleGroup;
    patch?: SharedPatch;
    currentDistillerIds: number[];
    actorId: number;
    user: User;
    creationSource: CatalogVerificationCreationSource;
    changedEntityIds: Set<number>;
    newEntityIds: Set<number>;
  },
): Promise<StableState> {
  const numericBrand =
    typeof patch?.brand === "number" ? await loadEntity(tx, patch.brand) : null;
  if (numericBrand) requireEntityRole(numericBrand, "brand", "Brand");

  const numericBottler =
    typeof patch?.bottler === "number"
      ? await loadEntity(tx, patch.bottler)
      : null;
  if (numericBottler) requireEntityRole(numericBottler, "bottler", "Bottler");

  const numericDistillers = new Map<number, Entity>();
  for (const choice of patch?.distillers ?? []) {
    if (typeof choice !== "number" || numericDistillers.has(choice)) continue;
    const distiller = await loadEntity(tx, choice);
    requireEntityRole(distiller, "distiller", "Distiller");
    numericDistillers.set(choice, distiller);
  }

  let brand: Entity;
  if (numericBrand) {
    brand = numericBrand;
  } else if (patch?.brand !== undefined && typeof patch.brand !== "number") {
    const result = await upsertEntity({
      db: tx,
      data: coerceToUpsert(patch.brand),
      creationSource,
      userId: user.id,
      createdByActorId: actorId,
      type: "brand",
    });
    if (!result) {
      throw new ConcreteBottleUpdateInputError("Brand could not be resolved.");
    }
    brand = result.result;
    if (result.changed) changedEntityIds.add(result.id);
    if (result.created) newEntityIds.add(result.id);
  } else {
    brand = await loadEntity(tx, group.brandId);
  }

  let bottler: Entity | null;
  if (patch?.bottler === null) {
    bottler = null;
  } else if (numericBottler) {
    bottler = numericBottler;
  } else if (
    patch?.bottler !== undefined &&
    typeof patch.bottler !== "number"
  ) {
    const result = await upsertEntity({
      db: tx,
      data: coerceToUpsert(patch.bottler),
      creationSource,
      userId: user.id,
      createdByActorId: actorId,
      type: "bottler",
    });
    if (!result) {
      throw new ConcreteBottleUpdateInputError(
        "Bottler could not be resolved.",
      );
    }
    bottler = result.result;
    if (result.changed) changedEntityIds.add(result.id);
    if (result.created) newEntityIds.add(result.id);
  } else {
    bottler =
      group.bottlerId === null ? null : await loadEntity(tx, group.bottlerId);
  }

  const distillerIds: number[] = [];
  if (patch?.distillers === undefined) {
    distillerIds.push(...currentDistillerIds);
  } else {
    for (const choice of patch.distillers) {
      if (typeof choice === "number") {
        distillerIds.push(numericDistillers.get(choice)!.id);
        continue;
      }
      const result = await upsertEntity({
        db: tx,
        data: coerceToUpsert(choice),
        creationSource,
        userId: user.id,
        createdByActorId: actorId,
        type: "distiller",
      });
      if (!result) {
        throw new ConcreteBottleUpdateInputError(
          "Distiller could not be resolved.",
        );
      }
      distillerIds.push(result.id);
      if (result.changed) changedEntityIds.add(result.id);
      if (result.created) newEntityIds.add(result.id);
    }
  }
  const normalizedDistillerIds = Array.from(new Set(distillerIds)).sort(
    (left, right) => left - right,
  );

  let statedAge = valueOrCurrent(patch?.statedAge, group.statedAge);
  let name = patch?.name ?? group.name;
  if (patch?.name !== undefined) {
    const normalized = normalizeBottleAge({
      name: normalizeBottleAliasKey(patch.name),
      statedAge,
    });
    name = normalized.name;
    if (patch.statedAge === undefined) statedAge = normalized.statedAge;
  }
  name = stripDuplicateBrandPrefixFromBottleName(name, brand.name);
  if (!name || bottleNameDuplicatesBrand(name, brand.name)) {
    throw new ConcreteBottleUpdateInputError(
      "Bottle name must identify an expression distinct from the brand.",
    );
  }

  let seriesId = group.seriesId;
  if (patch?.series !== undefined) {
    try {
      [seriesId] = await processSeries({
        tx,
        series: patch.series,
        brand,
        userId: user.id,
        createdByActorId: actorId,
      });
    } catch (error) {
      if (
        error instanceof ORPCError &&
        ["NOT_FOUND", "BAD_REQUEST", "INPUT_VALIDATION_FAILED"].includes(
          error.code,
        )
      ) {
        throw new ConcreteBottleUpdateInputError(error.message);
      }
      throw error;
    }
  }
  if (patch !== undefined && seriesId !== null) {
    const [series] = await tx
      .select({ brandId: bottleSeries.brandId })
      .from(bottleSeries)
      .where(eq(bottleSeries.id, seriesId))
      .limit(1);
    if (!series) {
      throw new ConcreteBottleUpdateInputError(
        `Series ${seriesId} could not be resolved.`,
      );
    }
    if (series.brandId !== brand.id) {
      throw new ConcreteBottleUpdateInputError(
        `Series ${seriesId} does not belong to brand ${brand.id}.`,
      );
    }
  }

  return {
    name,
    fullName: formatBottleName({
      name: `${brand.shortName || brand.name} ${name}`,
    }),
    statedAge,
    brandId: brand.id,
    bottlerId: bottler?.id ?? null,
    seriesId,
    category: valueOrCurrent(patch?.category, group.category),
    flavorProfile: valueOrCurrent(patch?.flavorProfile, group.flavorProfile),
    brand,
    bottler,
    distillerIds: normalizedDistillerIds,
  };
}

function stableDiff(group: BottleGroup, stable: StableState) {
  return (
    group.name !== stable.name ||
    group.fullName !== stable.fullName ||
    group.statedAge !== stable.statedAge ||
    group.brandId !== stable.brandId ||
    group.bottlerId !== stable.bottlerId ||
    group.seriesId !== stable.seriesId ||
    group.category !== stable.category ||
    group.flavorProfile !== stable.flavorProfile
  );
}

function emptyResult(
  bottle: Bottle,
  group: BottleGroup,
  creationSource: CatalogVerificationCreationSource,
): ConcreteBottleUpdateFinalizationManifest {
  return {
    bottle,
    group,
    changed: false,
    creationSource,
    changedBottleIds: [],
    changedAliasNames: [],
    changedEntityIds: [],
    newEntityIds: [],
    affectedSeriesIds: [],
  };
}

/**
 * Performs the complete locked concrete Bottle update transaction. The caller
 * must finalize the returned manifest only after its outermost transaction
 * commits. Optional expected shared state is compared while the BottleGroup
 * and every referenced series preimage remain locked.
 */
export async function updateConcreteBottleInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    input,
    expectedSharedState,
    user,
    actorId,
    creationSource,
  }: {
    bottleId: number;
    input: ConcreteBottleUpdateInput;
    expectedSharedState?: ConcreteBottleUpdateExpectedSharedState;
    user: User;
    actorId: number;
    creationSource: CatalogVerificationCreationSource;
  },
): Promise<ConcreteBottleUpdateFinalizationManifest> {
  const [discoveredBottle] = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1);
  if (!discoveredBottle) {
    throw new ConcreteBottleUpdateGraphError("not_found", bottleId);
  }
  if (discoveredBottle.groupId === null) {
    throw new ConcreteBottleUpdateGraphError("missing_group", bottleId);
  }
  const groupId = discoveredBottle.groupId;

  // Group-first locking gives graph writers one order; the Bottle is re-read
  // under that lock because discovery above was intentionally unlocked.
  const [group] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId))
    .limit(1)
    .for("update");
  if (!group) {
    throw new ConcreteBottleUpdateGraphError(
      "invalid_catalog_graph",
      bottleId,
      groupId,
    );
  }

  const [lockedBottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1)
    .for("update");
  if (!lockedBottle || lockedBottle.groupId !== groupId) {
    throw new ConcreteBottleUpdateGraphError(
      "invalid_catalog_graph",
      bottleId,
      groupId,
    );
  }

  const [groupTombstone] = await tx
    .select({ id: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, groupId))
    .limit(1);
  const [bottleTombstone] = await tx
    .select({ id: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottleId))
    .limit(1);
  if (groupTombstone || bottleTombstone) {
    throw new ConcreteBottleUpdateGraphError("retired", bottleId, groupId);
  }

  const sharedIntent = hasFields(input.shared);
  const exactIntent = hasFields(input.exact);
  let members = [lockedBottle];
  if (sharedIntent) {
    const lockedMembers = await tx
      .select()
      .from(bottles)
      .where(eq(bottles.groupId, groupId))
      .orderBy(asc(bottles.id))
      .for("update");
    const tombstones = lockedMembers.length
      ? await tx
          .select({ bottleId: bottleTombstones.bottleId })
          .from(bottleTombstones)
          .where(
            inArray(
              bottleTombstones.bottleId,
              lockedMembers.map(({ id }) => id),
            ),
          )
      : [];
    const retiredIds = new Set(tombstones.map(({ bottleId }) => bottleId));
    members = lockedMembers.filter(({ id }) => !retiredIds.has(id));
    if (
      members.length === 0 ||
      (group.representativeBottleId !== null &&
        !members.some(({ id }) => id === group.representativeBottleId))
    ) {
      throw new ConcreteBottleUpdateGraphError(
        "invalid_catalog_graph",
        bottleId,
        groupId,
      );
    }
  }

  const genericTargets = await tx
    .select()
    .from(catalogTargets)
    .where(
      and(eq(catalogTargets.groupId, groupId), isNull(catalogTargets.bottleId)),
    )
    .for("update");
  const exactTargets = await tx
    .select()
    .from(catalogTargets)
    .where(
      and(
        eq(catalogTargets.groupId, groupId),
        inArray(
          catalogTargets.bottleId,
          members.map(({ id }) => id),
        ),
      ),
    )
    .orderBy(asc(catalogTargets.bottleId))
    .for("update");
  const targetByBottleId = new Map(
    exactTargets.flatMap((target) =>
      target.bottleId === null ? [] : [[target.bottleId, target] as const],
    ),
  );
  if (
    genericTargets.length !== 1 ||
    exactTargets.length !== members.length ||
    members.some(({ id }) => !targetByBottleId.has(id))
  ) {
    throw new ConcreteBottleUpdateGraphError(
      "invalid_catalog_graph",
      bottleId,
      groupId,
    );
  }

  if (!sharedIntent && !exactIntent) {
    return emptyResult(lockedBottle, group, creationSource);
  }

  const currentGroupDistillers = await tx
    .select({ distillerId: bottleGroupDistillers.distillerId })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, groupId))
    .orderBy(asc(bottleGroupDistillers.distillerId));
  const currentGroupDistillerIds = currentGroupDistillers.map(
    ({ distillerId }) => distillerId,
  );
  if (expectedSharedState) {
    const groupChanged = expectedGroupKeys.some(
      (key) =>
        JSON.stringify(group[key]) !==
        JSON.stringify(expectedSharedState.group[key]),
    );
    const expectedSeriesById = new Map(
      [
        expectedSharedState.series,
        ...expectedSharedState.referencedSeries,
      ].flatMap((series) => (series ? [[series.id, series] as const] : [])),
    );
    const expectedSeriesIds = Array.from(expectedSeriesById.keys()).sort(
      (left, right) => left - right,
    );
    const currentSeriesRows = expectedSeriesIds.length
      ? await tx
          .select()
          .from(bottleSeries)
          .where(inArray(bottleSeries.id, expectedSeriesIds))
          .orderBy(asc(bottleSeries.id))
          .for("share")
      : [];
    const seriesChanged =
      currentSeriesRows.length !== expectedSeriesById.size ||
      currentSeriesRows.some((series) => {
        const expected = expectedSeriesById.get(series.id);
        return !expected || !sameExpectedSeries(series, expected);
      });
    if (
      groupChanged ||
      !sameValues(currentGroupDistillerIds, expectedSharedState.distillerIds) ||
      seriesChanged
    ) {
      throw new ConcreteBottleUpdateExpectedStateError(groupId);
    }
  }
  const changedEntityIds = new Set<number>();
  const newEntityIds = new Set<number>();
  const stable = await resolveStableState(tx, {
    group,
    patch: sharedIntent ? input.shared : undefined,
    currentDistillerIds: currentGroupDistillerIds,
    actorId,
    user,
    creationSource,
    changedEntityIds,
    newEntityIds,
  });
  const groupFieldsChanged = stableDiff(group, stable);
  const groupDistillersChanged = !sameValues(
    currentGroupDistillerIds,
    stable.distillerIds,
  );
  const exactIdentityIntent = hasExactIdentityFields(input.exact);

  const bottleDistillerRows = await tx
    .select()
    .from(bottlesToDistillers)
    .where(
      inArray(
        bottlesToDistillers.bottleId,
        members.map(({ id }) => id),
      ),
    )
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    );
  const bottleDistillers = new Map<number, number[]>();
  for (const row of bottleDistillerRows) {
    const ids = bottleDistillers.get(row.bottleId) ?? [];
    ids.push(row.distillerId);
    bottleDistillers.set(row.bottleId, ids);
  }

  const sharedDesiredByBottleId = new Map<number, DesiredBottle>();
  const desiredByBottleId = new Map<number, DesiredBottle>();
  for (const member of members) {
    // Shared intent rematerializes identity even when group values compare
    // equal, because the operation is also the repair path for member drift.
    const sharedDesired = desiredBottleFor({
      bottle: member,
      oldGroupStatedAge: group.statedAge,
      stable,
      materializeSharedFields: sharedIntent,
      regenerateIdentity: sharedIntent,
    });
    sharedDesiredByBottleId.set(member.id, sharedDesired);
    desiredByBottleId.set(
      member.id,
      exactIntent && member.id === bottleId
        ? desiredBottleFor({
            bottle: member,
            oldGroupStatedAge: group.statedAge,
            stable,
            exactPatch: input.exact,
            materializeSharedFields: sharedIntent,
            regenerateIdentity: sharedIntent || exactIdentityIntent,
          })
        : sharedDesired,
    );
  }

  const memberMaterializationChanged = sharedIntent
    ? members.some((member) => {
        const desired = sharedDesiredByBottleId.get(member.id)!;
        return (
          Object.keys(bottleDiff(member, desired)).length > 0 ||
          !sameValues(
            bottleDistillers.get(member.id) ?? [],
            stable.distillerIds,
          )
        );
      })
    : false;
  const sharedChanged =
    sharedIntent &&
    (groupFieldsChanged ||
      groupDistillersChanged ||
      memberMaterializationChanged ||
      changedEntityIds.size > 0);
  const selectedDesired = desiredByBottleId.get(bottleId)!;
  const selectedSharedDesired = sharedDesiredByBottleId.get(bottleId)!;
  const exactChanged =
    exactIntent &&
    Object.keys(bottleDiff(selectedSharedDesired, selectedDesired)).length > 0;

  if (!sharedChanged && !exactChanged) {
    return emptyResult(lockedBottle, group, creationSource);
  }

  const affectedMembers = sharedChanged
    ? members
    : members.filter(({ id }) => id === bottleId);
  const affectedIds = affectedMembers.map(({ id }) => id).sort((a, b) => a - b);

  const currentBrand =
    stable.brandId === group.brandId
      ? stable.brand
      : await loadEntity(tx, group.brandId);
  const currentBottler =
    group.bottlerId === null
      ? null
      : stable.bottlerId === group.bottlerId
        ? stable.bottler
        : await loadEntity(tx, group.bottlerId);
  let changedAliasNames: string[];
  try {
    ({ changedAliasNames } = await reserveConcreteBottleIdentitiesInTransaction(
      tx,
      {
        candidates: affectedMembers.map((member) => {
          const desired = desiredByBottleId.get(member.id)!;
          return {
            bottleId: member.id,
            targetId: targetByBottleId.get(member.id)!.id,
            current: {
              name: member.name,
              fullName: member.fullName,
              brand: currentBrand,
              bottler: currentBottler,
            },
            desired: {
              name: desired.name,
              fullName: desired.fullName,
              brand: stable.brand,
              bottler: stable.bottler,
            },
          };
        }),
        assignedByActorId: actorId,
      },
    ));
  } catch (error) {
    if (error instanceof ConcreteBottleIdentityConflictError) {
      throw new ConcreteBottleUpdateConflictError(error.conflictingBottleId);
    }
    throw error;
  }

  let persistedGroup = group;
  if (groupFieldsChanged || groupDistillersChanged) {
    [persistedGroup] = await tx
      .update(bottleGroups)
      .set({
        name: stable.name,
        fullName: stable.fullName,
        statedAge: stable.statedAge,
        brandId: stable.brandId,
        bottlerId: stable.bottlerId,
        seriesId: stable.seriesId,
        category: stable.category,
        flavorProfile: stable.flavorProfile,
        updatedAt: new Date(),
      })
      .where(eq(bottleGroups.id, groupId))
      .returning();
    if (!persistedGroup) {
      throw new ConcreteBottleUpdateGraphError(
        "invalid_catalog_graph",
        bottleId,
        groupId,
      );
    }
  }

  if (sharedChanged) {
    await tx
      .delete(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, groupId));
    if (stable.distillerIds.length) {
      await tx
        .insert(bottleGroupDistillers)
        .values(
          stable.distillerIds.map((distillerId) => ({ groupId, distillerId })),
        );
    }
    await tx
      .delete(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, affectedIds));
    if (stable.distillerIds.length) {
      await tx.insert(bottlesToDistillers).values(
        affectedIds.flatMap((memberBottleId) =>
          stable.distillerIds.map((distillerId) => ({
            bottleId: memberBottleId,
            distillerId,
          })),
        ),
      );
    }
  }

  const updatedBottles = new Map<number, Bottle>();
  for (const member of affectedMembers) {
    const desired = desiredByBottleId.get(member.id)!;
    const [updated] = await tx
      .update(bottles)
      .set({ ...desired, updatedAt: new Date() })
      .where(and(eq(bottles.id, member.id), eq(bottles.groupId, groupId)))
      .returning();
    if (!updated) {
      throw new ConcreteBottleUpdateGraphError(
        "invalid_catalog_graph",
        bottleId,
        groupId,
      );
    }
    updatedBottles.set(member.id, updated);

    const updateScope =
      sharedChanged && exactChanged && member.id === bottleId
        ? "mixed"
        : sharedChanged
          ? "shared"
          : "exact";
    await tx.insert(changes).values({
      objectType: "bottle",
      objectId: member.id,
      actorId,
      displayName: updated.fullName,
      type: "update",
      data: {
        ...bottleDiff(member, desired),
        updateScope,
        creationSource,
        groupId,
        requestedBottleId: bottleId,
        distillerIds: sharedChanged
          ? stable.distillerIds
          : (bottleDistillers.get(member.id) ?? []),
      },
    });
  }

  const memberSeriesChanged =
    sharedChanged &&
    affectedMembers.some(
      (member) =>
        member.seriesId !== desiredByBottleId.get(member.id)!.seriesId,
    );
  const affectedSeriesIds = memberSeriesChanged
    ? Array.from(
        new Set(
          affectedMembers
            .flatMap((member) => [
              member.seriesId,
              desiredByBottleId.get(member.id)!.seriesId,
            ])
            .filter((seriesId): seriesId is number => seriesId !== null),
        ),
      ).sort((left, right) => left - right)
    : [];
  for (const seriesId of affectedSeriesIds) {
    await tx
      .update(bottleSeries)
      .set({
        numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${seriesId})`,
      })
      .where(eq(bottleSeries.id, seriesId));
  }

  return {
    bottle: updatedBottles.get(bottleId)!,
    group: persistedGroup,
    changed: true,
    creationSource,
    changedBottleIds: affectedIds,
    changedAliasNames,
    changedEntityIds: Array.from(changedEntityIds).sort(
      (left, right) => left - right,
    ),
    newEntityIds: Array.from(newEntityIds).sort((left, right) => left - right),
    affectedSeriesIds,
  };
}

/** Dispatches idempotent update work only after the outer transaction commits. */
export async function finalizeConcreteBottleUpdate(
  result: ConcreteBottleUpdateFinalizationManifest,
) {
  for (const bottleId of result.changedBottleIds) {
    try {
      await pushUniqueJob("OnBottleChange", { bottleId });
    } catch (error) {
      logError(error, { bottle: { id: bottleId } });
    }
  }
  for (const name of result.changedAliasNames) {
    try {
      await pushUniqueJob("OnBottleAliasChange", { name });
    } catch (error) {
      logError(error, {
        bottle: { id: result.bottle.id },
        alias: { name },
      });
    }
  }
  for (const entityId of result.changedEntityIds) {
    try {
      await pushUniqueJob("OnEntityChange", { entityId });
    } catch (error) {
      logError(error, { entity: { id: entityId } });
    }
  }
  for (const entityId of result.newEntityIds) {
    try {
      await queueEntityCreationVerification({
        entityId,
        creationSource: result.creationSource,
      });
    } catch (error) {
      logError(error, { entity: { id: entityId } });
    }
  }
  for (const seriesId of result.affectedSeriesIds) {
    try {
      await pushUniqueJob("IndexBottleSeriesSearchVectors", { seriesId });
    } catch (error) {
      logError(error, { series: { id: seriesId } });
    }
  }
}

/** Authorizes and parses an untrusted moderator update before touching storage. */
export async function updateConcreteBottle({
  bottleId,
  input: rawInput,
  context,
}: {
  bottleId: number;
  input: unknown;
  context: Context;
}): Promise<ConcreteBottleUpdateResult> {
  if (!context.user?.admin && !context.user?.mod) {
    throw new ConcreteBottleUpdateAuthorizationError();
  }
  if (!Number.isInteger(bottleId) || bottleId <= 0) {
    throw new ConcreteBottleUpdateInputError(
      "Bottle ID must be a positive integer.",
    );
  }
  const input = ConcreteBottleUpdateInputSchema.parse(rawInput);
  const user = context.user;
  const actor = await getUserActor(user);
  const result = await db.transaction((tx) =>
    updateConcreteBottleInTransaction(tx, {
      bottleId,
      input,
      user,
      actorId: actor.id,
      creationSource: "manual_entry",
    }),
  );
  await finalizeConcreteBottleUpdate(result);
  return {
    bottle: result.bottle,
    group: result.group,
    changed: result.changed,
  };
}
