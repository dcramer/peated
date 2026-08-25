/**
 * Transactional moderator editing for Bottles. Shared patches fan out
 * durable member Bottle materialization; exact patches remain isolated.
 */
// TODO(dcramer): Rename this module's BottleUpdate symbols now that
// the Bottle/BottleRelease distinction is retired.
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
} from "@peated/server/db/schema";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTombstones,
  changes,
  entities,
} from "@peated/server/db/schema";
import { getPeatedSystemActor, getUserActor } from "@peated/server/lib/actors";
import {
  BottleIdentityConflictError,
  reserveBottleIdentitiesInTransaction,
} from "@peated/server/lib/bottleConflicts";
import { processSeries } from "@peated/server/lib/bottleHelpers";
import {
  getBottleExactIdentity,
  getBottleExactStatedAge,
  materializeBottleForGroup,
} from "@peated/server/lib/bottleIdentity";
import {
  BottlePatchSchema,
  type BottlePatch,
  type SystemBottlePatch,
} from "@peated/server/lib/bottleSchemas";
import { queueEntityCreationVerification } from "@peated/server/lib/catalogVerification";
import { coerceToUpsert, upsertEntity } from "@peated/server/lib/db";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import type { Context } from "@peated/server/orpc/context";
import { EntityChoiceInputSchema } from "@peated/server/schemas";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

export { BottlePatchSchema } from "@peated/server/lib/bottleSchemas";
export type { BottlePatch } from "@peated/server/lib/bottleSchemas";

type SharedPatch = Partial<
  Pick<
    SystemBottlePatch,
    | "name"
    | "statedAge"
    | "series"
    | "category"
    | "brand"
    | "distillers"
    | "bottler"
    | "flavorProfile"
  >
>;
type ExactPatch = Partial<
  Pick<
    SystemBottlePatch,
    | "edition"
    | "statedAge"
    | "noAgeStatement"
    | "abv"
    | "singleCask"
    | "caskStrength"
    | "naturalColor"
    | "nonChillFiltered"
    | "vintageYear"
    | "releaseYear"
    | "caskSize"
    | "caskType"
    | "caskFill"
    | "description"
    | "descriptionSrc"
    | "image"
    | "tastingNotes"
    | "suggestedTags"
  >
>;

type BottleStoragePatch = {
  shared?: SharedPatch;
  exact?: ExactPatch;
};

export class BottleUpdateAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to update a Bottle.");
    this.name = "BottleUpdateAuthorizationError";
  }
}

export type BottleUpdateGraphErrorCode =
  | "not_found"
  | "retired"
  | "missing_group"
  | "invalid_catalog_graph";

export class BottleUpdateGraphError extends Error {
  constructor(
    readonly code: BottleUpdateGraphErrorCode,
    readonly bottleId: number,
    readonly groupId: number | null = null,
  ) {
    super(`Cannot update Bottle ${bottleId}: ${code}.`);
    this.name = "BottleUpdateGraphError";
  }
}

export class BottleUpdateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleUpdateInputError";
  }
}

export class BottleUpdateConflictError extends Error {
  constructor(readonly conflictingBottleId: number | null) {
    super("Bottle identity conflicts with an existing Bottle.");
    this.name = "BottleUpdateConflictError";
  }
}

export class BottleUpdateExpectedStateError extends Error {
  constructor(readonly groupId: number) {
    super(`BottleGroup ${groupId} shared authority changed before update.`);
    this.name = "BottleUpdateExpectedStateError";
  }
}

export class BottleUpdateExpectedBottleStateError extends Error {
  constructor(readonly bottleId: number) {
    super(
      `Bottle ${bottleId} exact content or membership changed before update.`,
    );
    this.name = "BottleUpdateExpectedBottleStateError";
  }
}

export type BottleUpdateResult = {
  bottle: Bottle;
  group: BottleGroup;
  changed: boolean;
};

export type BottleUpdateFinalizationManifest = BottleUpdateResult & {
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
  | "noAgeStatement"
  | "brandId"
  | "bottlerId"
  | "seriesId"
  | "category"
  | "flavorProfile"
  | "edition"
  | "abv"
  | "singleCask"
  | "caskStrength"
  | "naturalColor"
  | "nonChillFiltered"
  | "vintageYear"
  | "releaseYear"
  | "caskSize"
  | "caskType"
  | "caskFill"
  | "description"
  | "descriptionSrc"
  | "imageUrl"
  | "rejectedImageUrls"
  | "tastingNotes"
  | "suggestedTags"
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
export type BottleUpdateExpectedEntityState = Pick<
  Entity,
  "id" | "name" | "shortName" | "type"
>;

export type BottleUpdateExpectedSharedState = {
  group: Pick<BottleGroup, (typeof expectedGroupKeys)[number]>;
  distillerIds: number[];
  referencedEntities: BottleUpdateExpectedEntityState[];
  series: ExpectedSeries | null;
  referencedSeries: ExpectedSeries[];
};

const expectedSelectedBottleKeys = [
  "groupId",
  "fullName",
  "statedAge",
  "noAgeStatement",
  "category",
  "flavorProfile",
  "description",
  "descriptionSrc",
  "naturalColor",
  "nonChillFiltered",
  "tastingNotes",
  "suggestedTags",
] as const satisfies ReadonlyArray<keyof Bottle>;

export type BottleUpdateExpectedSelectedBottleState = Pick<
  Bottle,
  (typeof expectedSelectedBottleKeys)[number]
>;

/** Captures selected-Bottle state used to plan an exact-content edit. */
export function bottleUpdateExpectedSelectedBottleState(
  bottle: Bottle,
): BottleUpdateExpectedSelectedBottleState {
  return {
    groupId: bottle.groupId,
    fullName: bottle.fullName,
    statedAge: bottle.statedAge,
    noAgeStatement: bottle.noAgeStatement,
    category: bottle.category,
    flavorProfile: bottle.flavorProfile,
    description: bottle.description,
    descriptionSrc: bottle.descriptionSrc,
    naturalColor: bottle.naturalColor,
    nonChillFiltered: bottle.nonChillFiltered,
    tastingNotes: bottle.tastingNotes,
    suggestedTags: bottle.suggestedTags,
  };
}

function sortedEntityRoles(roles: Entity["type"]): Entity["type"] {
  const sorted = [...roles].sort();
  const first = sorted[0];
  if (!first) {
    throw new Error("An Entity must have at least one role.");
  }
  return [first, ...sorted.slice(1)];
}

/** Captures the shared authority a maintenance caller used to plan an edit. */
export function bottleUpdateExpectedSharedState({
  group,
  distillerIds,
  referencedEntities = [],
  referencedSeries = [],
  series,
}: {
  group: BottleGroup;
  distillerIds: number[];
  referencedEntities?: BottleUpdateExpectedEntityState[];
  referencedSeries?: BottleSeries[];
  series: BottleSeries | null;
}): BottleUpdateExpectedSharedState {
  return {
    group: {
      id: group.id,
      name: group.name,
      fullName: group.fullName,
      statedAge: group.statedAge,
      brandId: group.brandId,
      bottlerId: group.bottlerId,
      seriesId: group.seriesId,
      category: group.category,
      flavorProfile: group.flavorProfile,
      representativeBottleId: group.representativeBottleId,
    },
    distillerIds: [...distillerIds].sort((left, right) => left - right),
    referencedEntities: referencedEntities
      .map(({ id, name, shortName, type }) => ({
        id,
        name,
        shortName,
        type: sortedEntityRoles(type),
      }))
      .sort((left, right) => left.id - right.id),
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

function hasFields<T extends object>(value: T | undefined): boolean {
  return value !== undefined && Object.keys(value).length > 0;
}

/**
 * Bottle update owns the storage map. Callers submit Bottle fields and never
 * choose BottleGroup versus Bottle persistence.
 */
export function bottleStoragePatch(
  input: SystemBottlePatch,
  {
    bottleStatedAge,
    groupStatedAge,
  }: {
    bottleStatedAge: Bottle["statedAge"];
    groupStatedAge: BottleGroup["statedAge"];
  },
): BottleStoragePatch {
  const shared: SharedPatch = {};
  const exact: ExactPatch = {};

  if ("name" in input) shared.name = input.name;
  if ("series" in input) shared.series = input.series;
  if ("category" in input) shared.category = input.category;
  if ("brand" in input) shared.brand = input.brand;
  if ("distillers" in input) shared.distillers = input.distillers;
  if ("bottler" in input) shared.bottler = input.bottler;
  if ("flavorProfile" in input) shared.flavorProfile = input.flavorProfile;

  if ("edition" in input) exact.edition = input.edition;
  if ("statedAge" in input) {
    // Null must clear the effective age. With no exact override, the group is
    // the storage owner and the clear must fan out to every member.
    const clearsSharedAge =
      input.statedAge === null &&
      groupStatedAge !== null &&
      getBottleExactStatedAge({
        bottleStatedAge,
        stableStatedAge: groupStatedAge,
      }) === null;
    if (clearsSharedAge) {
      shared.statedAge = null;
    } else {
      exact.statedAge = input.statedAge;
    }
    if (input.statedAge !== null && !("noAgeStatement" in input)) {
      exact.noAgeStatement = null;
    }
  }
  if ("noAgeStatement" in input) {
    exact.noAgeStatement = input.noAgeStatement;
  }
  if ("abv" in input) exact.abv = input.abv;
  if ("singleCask" in input) exact.singleCask = input.singleCask;
  if ("caskStrength" in input) exact.caskStrength = input.caskStrength;
  if ("naturalColor" in input) exact.naturalColor = input.naturalColor;
  if ("nonChillFiltered" in input) {
    exact.nonChillFiltered = input.nonChillFiltered;
  }
  if ("vintageYear" in input) exact.vintageYear = input.vintageYear;
  if ("releaseYear" in input) exact.releaseYear = input.releaseYear;
  if ("caskSize" in input) exact.caskSize = input.caskSize;
  if ("caskType" in input) exact.caskType = input.caskType;
  if ("caskFill" in input) exact.caskFill = input.caskFill;
  if ("description" in input) exact.description = input.description;
  if ("descriptionSrc" in input) exact.descriptionSrc = input.descriptionSrc;
  if ("image" in input) exact.image = input.image;
  if ("tastingNotes" in input) exact.tastingNotes = input.tastingNotes;
  if ("suggestedTags" in input) exact.suggestedTags = input.suggestedTags;

  const storage: BottleStoragePatch = {};
  if (hasFields(shared)) storage.shared = shared;
  if (hasFields(exact)) storage.exact = exact;
  return storage;
}

type ExistingEntityChoice =
  | SystemBottlePatch["brand"]
  | SystemBottlePatch["bottler"]
  | NonNullable<SystemBottlePatch["distillers"]>[number];

function existingEntityChoiceId(choice: ExistingEntityChoice): number | null {
  const numericChoice = z.number().safeParse(choice);
  if (numericChoice.success) return numericChoice.data;
  const objectChoice = z.object({ id: z.number() }).safeParse(choice);
  return objectChoice.success ? objectChoice.data.id : null;
}

function numericEntityChoiceId(choice: ExistingEntityChoice): number | null {
  const numericChoice = z.number().safeParse(choice);
  return numericChoice.success ? numericChoice.data : null;
}

function entityDraftChoice(choice: ExistingEntityChoice) {
  return EntityChoiceInputSchema.parse(choice);
}

function existingEntityIdsForUpdate(input: SystemBottlePatch): number[] {
  const choices = [input.brand, input.bottler, ...(input.distillers ?? [])];
  return choices.flatMap((choice) => {
    const id = existingEntityChoiceId(choice);
    return id === null ? [] : [id];
  });
}

const exactIdentityKeys: ReadonlyArray<keyof ExactPatch> = [
  "edition",
  "statedAge",
  "noAgeStatement",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskType",
  "caskSize",
  "caskFill",
];

const generatedDetailsIdentityKeys = [
  "statedAge",
  "noAgeStatement",
  "brandId",
  "bottlerId",
  "seriesId",
  "category",
  "edition",
  "abv",
  "singleCask",
  "caskStrength",
  "vintageYear",
  "releaseYear",
] as const satisfies ReadonlyArray<keyof DesiredBottle>;

function hasExactIdentityFields(patch: ExactPatch | undefined): boolean {
  return patch !== undefined && exactIdentityKeys.some((key) => key in patch);
}

function sameValues(left: readonly number[], right: readonly number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function generatedDetailsIdentityChanged({
  bottle,
  desired,
  includeNameChange,
  currentDistillerIds,
  desiredDistillerIds,
}: {
  bottle: Bottle;
  desired: DesiredBottle;
  includeNameChange: boolean;
  currentDistillerIds: readonly number[];
  desiredDistillerIds: readonly number[];
}) {
  return (
    (includeNameChange &&
      (bottle.name !== desired.name || bottle.fullName !== desired.fullName)) ||
    generatedDetailsIdentityKeys.some(
      (key) => JSON.stringify(bottle[key]) !== JSON.stringify(desired[key]),
    ) ||
    !sameValues(currentDistillerIds, desiredDistillerIds)
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
  const exact = getBottleExactIdentity({
    bottle,
    sourceGroupStatedAge: oldGroupStatedAge,
    exactPatch,
  });
  const sharedMaterialization = materializeBottleForGroup({
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
  const rejectedImageUrls =
    exactPatch?.image === null && bottle.imageUrl
      ? Array.from(new Set([...bottle.rejectedImageUrls, bottle.imageUrl]))
      : bottle.rejectedImageUrls;

  return {
    name: identity.name,
    fullName: identity.fullName,
    statedAge: identity.statedAge,
    noAgeStatement: valueOrCurrent(
      exactPatch?.noAgeStatement,
      bottle.noAgeStatement,
    ),
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
    naturalColor: valueOrCurrent(exactPatch?.naturalColor, bottle.naturalColor),
    nonChillFiltered: valueOrCurrent(
      exactPatch?.nonChillFiltered,
      bottle.nonChillFiltered,
    ),
    vintageYear: exact.vintageYear,
    releaseYear: exact.releaseYear,
    caskSize: exact.caskSize,
    caskType: exact.caskType,
    caskFill: exact.caskFill,
    description,
    descriptionSrc,
    imageUrl: exactPatch?.image === null ? null : bottle.imageUrl,
    rejectedImageUrls,
    tastingNotes: valueOrCurrent(exactPatch?.tastingNotes, bottle.tastingNotes),
    suggestedTags: valueOrCurrent(
      exactPatch?.suggestedTags,
      bottle.suggestedTags,
    ),
  };
}

const desiredBottleKeys: ReadonlyArray<keyof DesiredBottle> = [
  "name",
  "fullName",
  "statedAge",
  "noAgeStatement",
  "brandId",
  "bottlerId",
  "seriesId",
  "category",
  "flavorProfile",
  "edition",
  "abv",
  "singleCask",
  "caskStrength",
  "naturalColor",
  "nonChillFiltered",
  "vintageYear",
  "releaseYear",
  "caskSize",
  "caskType",
  "caskFill",
  "description",
  "descriptionSrc",
  "imageUrl",
  "rejectedImageUrls",
  "tastingNotes",
  "suggestedTags",
];

function bottleDiff(bottle: DesiredBottle, desired: DesiredBottle) {
  const data: Partial<DesiredBottle> = {};
  for (const key of desiredBottleKeys) {
    if (JSON.stringify(bottle[key]) !== JSON.stringify(desired[key])) {
      Object.assign(data, { [key]: desired[key] });
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
    throw new BottleUpdateInputError(
      `Entity ${entityId} could not be resolved.`,
    );
  }
  return entity;
}

async function addEntityRoleIfNeeded({
  tx,
  entity,
  role,
  actorId,
  creationSource,
  changedEntityIds,
}: {
  tx: AnyTransaction;
  entity: Entity;
  role: Entity["type"][number];
  actorId: number;
  creationSource: CatalogVerificationCreationSource;
  changedEntityIds: Set<number>;
}): Promise<Entity> {
  if (entity.type.includes(role)) return entity;

  const result = await upsertEntity({
    db: tx,
    data: entity.id,
    creationSource,
    createdByActorId: actorId,
    type: role,
  });
  if (!result) {
    throw new BottleUpdateInputError(
      `Entity ${entity.id} could not be resolved.`,
    );
  }
  if (result.changed) changedEntityIds.add(result.id);
  return result.result;
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
    creationSource,
    changedEntityIds,
    newEntityIds,
  }: {
    group: BottleGroup;
    patch?: SharedPatch;
    currentDistillerIds: number[];
    actorId: number;
    creationSource: CatalogVerificationCreationSource;
    changedEntityIds: Set<number>;
    newEntityIds: Set<number>;
  },
): Promise<StableState> {
  const numericBrandId = numericEntityChoiceId(patch?.brand);
  let numericBrand =
    numericBrandId === null ? null : await loadEntity(tx, numericBrandId);
  if (numericBrand) {
    numericBrand = await addEntityRoleIfNeeded({
      tx,
      entity: numericBrand,
      role: "brand",
      actorId,
      creationSource,
      changedEntityIds,
    });
  }

  const numericBottlerId = numericEntityChoiceId(patch?.bottler);
  let numericBottler =
    numericBottlerId === null ? null : await loadEntity(tx, numericBottlerId);
  if (numericBottler) {
    numericBottler = await addEntityRoleIfNeeded({
      tx,
      entity: numericBottler,
      role: "bottler",
      actorId,
      creationSource,
      changedEntityIds,
    });
  }

  const numericDistillers = new Map<number, Entity>();
  for (const choice of patch?.distillers ?? []) {
    const choiceId = numericEntityChoiceId(choice);
    if (choiceId === null || numericDistillers.has(choiceId)) continue;
    const distiller = await addEntityRoleIfNeeded({
      tx,
      entity: await loadEntity(tx, choiceId),
      role: "distiller",
      actorId,
      creationSource,
      changedEntityIds,
    });
    numericDistillers.set(choiceId, distiller);
  }

  let brand: Entity;
  if (numericBrand) {
    brand = numericBrand;
  } else if (patch?.brand !== undefined && numericBrandId === null) {
    const result = await upsertEntity({
      db: tx,
      data: coerceToUpsert(entityDraftChoice(patch.brand)),
      creationSource,
      createdByActorId: actorId,
      type: "brand",
    });
    if (!result) {
      throw new BottleUpdateInputError("Brand could not be resolved.");
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
  } else if (patch?.bottler !== undefined && numericBottlerId === null) {
    const result = await upsertEntity({
      db: tx,
      data: coerceToUpsert(entityDraftChoice(patch.bottler)),
      creationSource,
      createdByActorId: actorId,
      type: "bottler",
    });
    if (!result) {
      throw new BottleUpdateInputError("Bottler could not be resolved.");
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
      const choiceId = numericEntityChoiceId(choice);
      if (choiceId !== null) {
        distillerIds.push(numericDistillers.get(choiceId)!.id);
        continue;
      }
      const result = await upsertEntity({
        db: tx,
        data: coerceToUpsert(entityDraftChoice(choice)),
        creationSource,
        createdByActorId: actorId,
        type: "distiller",
      });
      if (!result) {
        throw new BottleUpdateInputError("Distiller could not be resolved.");
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
    throw new BottleUpdateInputError(
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
        createdByActorId: actorId,
      });
    } catch (error) {
      if (
        error instanceof ORPCError &&
        ["NOT_FOUND", "BAD_REQUEST", "INPUT_VALIDATION_FAILED"].includes(
          error.code,
        )
      ) {
        throw new BottleUpdateInputError(error.message);
      }
      throw error;
    }
  } else if (
    patch?.brand !== undefined &&
    brand.id !== group.brandId &&
    seriesId !== null
  ) {
    // Move the series row only when no other catalog group depends on it.
    const [currentSeries] = await tx
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, seriesId))
      .limit(1)
      .for("update");
    if (!currentSeries) {
      throw new BottleUpdateInputError(
        `Series ${seriesId} could not be resolved.`,
      );
    }

    const destinationFullName = `${brand.name} ${currentSeries.name}`;
    const [destinationSeries] = await tx
      .select({ id: bottleSeries.id })
      .from(bottleSeries)
      .where(
        eq(
          sql`LOWER(${bottleSeries.fullName})`,
          destinationFullName.toLowerCase(),
        ),
      )
      .limit(1);
    if (destinationSeries && destinationSeries.id !== currentSeries.id) {
      seriesId = destinationSeries.id;
    } else {
      const [otherGroup] = await tx
        .select({ id: bottleGroups.id })
        .from(bottleGroups)
        .where(
          and(
            eq(bottleGroups.seriesId, currentSeries.id),
            ne(bottleGroups.id, group.id),
          ),
        )
        .limit(1);
      const [ungroupedBottle] = await tx
        .select({ id: bottles.id })
        .from(bottles)
        .where(
          and(eq(bottles.seriesId, currentSeries.id), isNull(bottles.groupId)),
        )
        .limit(1);

      if (!otherGroup && !ungroupedBottle) {
        await tx
          .update(bottleSeries)
          .set({
            brandId: brand.id,
            fullName: destinationFullName,
            updatedAt: new Date(),
          })
          .where(eq(bottleSeries.id, currentSeries.id));
        await tx.insert(changes).values({
          objectId: currentSeries.id,
          objectType: "bottle_series",
          type: "update",
          displayName: destinationFullName,
          data: {
            brandId: brand.id,
            fullName: destinationFullName,
          },
          actorId,
        });
      } else {
        try {
          [seriesId] = await processSeries({
            tx,
            series: {
              name: currentSeries.name,
              description: currentSeries.description,
            },
            brand,
            createdByActorId: actorId,
          });
        } catch (error) {
          if (
            error instanceof ORPCError &&
            ["NOT_FOUND", "BAD_REQUEST", "INPUT_VALIDATION_FAILED"].includes(
              error.code,
            )
          ) {
            throw new BottleUpdateInputError(error.message);
          }
          throw error;
        }
      }
    }
  }
  if (patch !== undefined && seriesId !== null) {
    const [series] = await tx
      .select({ brandId: bottleSeries.brandId })
      .from(bottleSeries)
      .where(eq(bottleSeries.id, seriesId))
      .limit(1);
    if (!series) {
      throw new BottleUpdateInputError(
        `Series ${seriesId} could not be resolved.`,
      );
    }
    if (series.brandId !== brand.id) {
      throw new BottleUpdateInputError(
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
): BottleUpdateFinalizationManifest {
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
 * Locks existing Entity choices before the selected BottleGroup and Bottle.
 * The order matches Entity writers and is safe to repeat before execution.
 */
export async function lockBottleUpdateDependencies(
  tx: AnyTransaction,
  bottleId: number,
  referencedEntityIds: readonly number[] = [],
): Promise<{
  bottle: Bottle;
  group: BottleGroup;
  referencedEntities: Entity[];
}> {
  const entityIds = Array.from(new Set(referencedEntityIds)).sort(
    (left, right) => left - right,
  );
  if (entityIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new BottleUpdateInputError(
      "Referenced Entity IDs must be positive integers.",
    );
  }
  const referencedEntities = entityIds.length
    ? await tx
        .select()
        .from(entities)
        .where(inArray(entities.id, entityIds))
        .orderBy(asc(entities.id))
        .for("share")
    : [];

  const [discoveredBottle] = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1);
  if (!discoveredBottle) {
    throw new BottleUpdateGraphError("not_found", bottleId);
  }
  if (discoveredBottle.groupId === null) {
    throw new BottleUpdateGraphError("missing_group", bottleId);
  }
  const groupId = discoveredBottle.groupId;

  const [group] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId))
    .limit(1)
    .for("update");
  if (!group) {
    throw new BottleUpdateGraphError(
      "invalid_catalog_graph",
      bottleId,
      groupId,
    );
  }

  const [bottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1)
    .for("update");
  if (!bottle || bottle.groupId !== groupId) {
    throw new BottleUpdateGraphError(
      "invalid_catalog_graph",
      bottleId,
      groupId,
    );
  }

  return { bottle, group, referencedEntities };
}

/**
 * Performs the complete locked Bottle update transaction. The caller
 * must finalize the returned manifest only after its outermost transaction
 * commits. Optional expected shared state is compared while its dependencies
 * remain locked.
 */
export async function updateBottleInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    input,
    expectedSelectedBottleState,
    expectedSharedState,
    actorId,
    creationSource,
    invalidateGeneratedDetails = true,
  }: {
    bottleId: number;
    input: SystemBottlePatch;
    expectedSelectedBottleState?: BottleUpdateExpectedSelectedBottleState;
    expectedSharedState?: BottleUpdateExpectedSharedState;
    actorId: number;
    creationSource: CatalogVerificationCreationSource;
    invalidateGeneratedDetails?: boolean;
  },
): Promise<BottleUpdateFinalizationManifest> {
  const expectedReferencedEntityIds =
    expectedSharedState?.referencedEntities.map(({ id }) => id) ?? [];
  const {
    bottle: lockedBottle,
    group,
    referencedEntities,
  } = await lockBottleUpdateDependencies(tx, bottleId, [
    ...expectedReferencedEntityIds,
    ...existingEntityIdsForUpdate(input),
  ]);
  const groupId = group.id;
  const storage = bottleStoragePatch(input, {
    bottleStatedAge: lockedBottle.statedAge,
    groupStatedAge: group.statedAge,
  });
  if (
    expectedSelectedBottleState &&
    expectedSelectedBottleKeys.some(
      (key) =>
        JSON.stringify(lockedBottle[key]) !==
        JSON.stringify(expectedSelectedBottleState[key]),
    )
  ) {
    throw new BottleUpdateExpectedBottleStateError(bottleId);
  }

  const [bottleTombstone] = await tx
    .select({ id: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottleId))
    .limit(1);
  if (bottleTombstone) {
    throw new BottleUpdateGraphError("retired", bottleId, groupId);
  }

  const sharedIntent = hasFields(storage.shared);
  const exactIntent = hasFields(storage.exact);
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
      group.representativeBottleId === null ||
      !members.some(({ id }) => id === group.representativeBottleId)
    ) {
      throw new BottleUpdateGraphError(
        "invalid_catalog_graph",
        bottleId,
        groupId,
      );
    }
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
    const expectedReferencedEntityIdSet = new Set(
      expectedSharedState.referencedEntities.map(({ id }) => id),
    );
    const currentReferencedEntities = referencedEntities
      .filter(({ id }) => expectedReferencedEntityIdSet.has(id))
      .map(({ id, name, shortName, type }) => ({ id, name, shortName, type }));
    const referencedEntitiesChanged =
      JSON.stringify(
        currentReferencedEntities.map((entity) => ({
          ...entity,
          type: [...entity.type].sort(),
        })),
      ) !== JSON.stringify(expectedSharedState.referencedEntities);
    if (
      groupChanged ||
      !sameValues(currentGroupDistillerIds, expectedSharedState.distillerIds) ||
      seriesChanged ||
      referencedEntitiesChanged
    ) {
      throw new BottleUpdateExpectedStateError(groupId);
    }
  }
  const changedEntityIds = new Set<number>();
  const newEntityIds = new Set<number>();
  const stable = await resolveStableState(tx, {
    group,
    patch: sharedIntent ? storage.shared : undefined,
    currentDistillerIds: currentGroupDistillerIds,
    actorId,
    creationSource,
    changedEntityIds,
    newEntityIds,
  });
  const groupFieldsChanged = stableDiff(group, stable);
  const groupDistillersChanged = !sameValues(
    currentGroupDistillerIds,
    stable.distillerIds,
  );
  if (group.brandId !== stable.brandId) {
    changedEntityIds.add(group.brandId);
    changedEntityIds.add(stable.brandId);
  }
  if (group.bottlerId !== stable.bottlerId) {
    if (group.bottlerId !== null) changedEntityIds.add(group.bottlerId);
    if (stable.bottlerId !== null) changedEntityIds.add(stable.bottlerId);
  }
  if (groupDistillersChanged) {
    for (const distillerId of [
      ...currentGroupDistillerIds,
      ...stable.distillerIds,
    ]) {
      changedEntityIds.add(distillerId);
    }
  }
  const exactIdentityIntent = hasExactIdentityFields(storage.exact);

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
            exactPatch: storage.exact,
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

  if (invalidateGeneratedDetails) {
    for (const member of affectedMembers) {
      const desired = desiredByBottleId.get(member.id)!;
      if (
        !generatedDetailsIdentityChanged({
          bottle: member,
          desired,
          includeNameChange: sharedIntent,
          currentDistillerIds: bottleDistillers.get(member.id) ?? [],
          desiredDistillerIds: sharedChanged
            ? stable.distillerIds
            : (bottleDistillers.get(member.id) ?? []),
        })
      ) {
        continue;
      }

      const selectedExactPatch =
        exactIntent && member.id === bottleId ? storage.exact : undefined;
      const descriptionWasExplicitlyPatched =
        selectedExactPatch !== undefined &&
        ("description" in selectedExactPatch ||
          "descriptionSrc" in selectedExactPatch);
      const suggestedTagsWereExplicitlyPatched =
        selectedExactPatch !== undefined &&
        "suggestedTags" in selectedExactPatch;

      const invalidated = { ...desired };
      if (
        member.descriptionSrc === "generated" &&
        !descriptionWasExplicitlyPatched
      ) {
        invalidated.description = null;
        invalidated.descriptionSrc = null;
      }
      if (
        !suggestedTagsWereExplicitlyPatched &&
        member.suggestedTags.length > 0
      ) {
        invalidated.suggestedTags = [];
      }
      desiredByBottleId.set(member.id, invalidated);
    }
  }

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
    ({ changedAliasNames } = await reserveBottleIdentitiesInTransaction(tx, {
      candidates: affectedMembers.map((member) => {
        const desired = desiredByBottleId.get(member.id)!;
        return {
          bottleId: member.id,
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
    }));
  } catch (error) {
    if (error instanceof BottleIdentityConflictError) {
      throw new BottleUpdateConflictError(error.conflictingBottleId);
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
      throw new BottleUpdateGraphError(
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
      throw new BottleUpdateGraphError(
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
  const seriesOwnershipChanged =
    sharedChanged &&
    group.brandId !== stable.brandId &&
    group.seriesId !== null &&
    group.seriesId === stable.seriesId;
  const affectedSeriesIds =
    memberSeriesChanged || seriesOwnershipChanged
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
export async function finalizeBottleUpdate(
  result: BottleUpdateFinalizationManifest,
) {
  for (const bottleId of result.changedBottleIds) {
    try {
      await pushUniqueJob("OnBottleChange", { bottleId });
    } catch (error) {
      logError(error, { extra: { bottleId } });
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

/** Actor resolution stays outside this transaction and post-commit boundary. */
async function updateBottleForActor({
  bottleId,
  input: rawInput,
  actorId,
  creationSource,
}: {
  bottleId: number;
  input: unknown;
  actorId: number;
  creationSource: CatalogVerificationCreationSource;
}): Promise<BottleUpdateResult> {
  if (!Number.isInteger(bottleId) || bottleId <= 0) {
    throw new BottleUpdateInputError("Bottle ID must be a positive integer.");
  }
  const input = BottlePatchSchema.parse(rawInput);
  const result = await db.transaction((tx) =>
    updateBottleInTransaction(tx, {
      bottleId,
      input,
      actorId,
      creationSource,
    }),
  );
  await finalizeBottleUpdate(result);
  return {
    bottle: result.bottle,
    group: result.group,
    changed: result.changed,
  };
}

/** Authorizes and parses an untrusted moderator update before touching storage. */
export async function updateBottle({
  bottleId,
  input,
  context,
}: {
  bottleId: number;
  input: unknown;
  context: Context;
}): Promise<BottleUpdateResult> {
  if (!context.user?.admin && !context.user?.mod) {
    throw new BottleUpdateAuthorizationError();
  }
  const actor = await getUserActor(context.user);
  return updateBottleForActor({
    bottleId,
    input,
    actorId: actor.id,
    creationSource: "manual_entry",
  });
}

/** Trusted scraper capability; automated updates are always Peated-owned. */
export async function updateBottleAsPeated({
  bottleId,
  input: rawInput,
}: {
  bottleId: number;
  input: unknown;
}): Promise<BottleUpdateResult> {
  const actor = await getPeatedSystemActor();
  return updateBottleForActor({
    bottleId,
    input: rawInput,
    actorId: actor.id,
    creationSource: "manual_entry",
  });
}
