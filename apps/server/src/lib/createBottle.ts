/**
 * Owns preparation and persistence for complete Bottle transactions.
 * Group-owned fields and distiller joins are durable parts of each Bottle's
 * independently renderable identity.
 */
import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleAliasKey,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import { type CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import { db, type AnyTransaction } from "@peated/server/db";
import type {
  Bottle,
  BottleGroup,
  Entity,
  NewBottle,
  User,
} from "@peated/server/db/schema";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import { getPeatedSystemActor, getUserActor } from "@peated/server/lib/actors";
import {
  ExactBottleAliasConflictError,
  reserveExactBottleAliasInTransaction,
  reserveLiteralCanonicalBottleAliasInTransaction,
} from "@peated/server/lib/bottleAliases";
import { processSeries } from "@peated/server/lib/bottleHelpers";
import {
  getCatalogVerificationCreationMetadata,
  queueBottleCreationVerification,
  queueEntityCreationVerification,
} from "@peated/server/lib/catalogVerification";
import { coerceToUpsert, upsertEntity } from "@peated/server/lib/db";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { resolveActiveBottleIds } from "@peated/server/lib/resolveActiveBottleIds";
import { buildBottleSearchVector } from "@peated/server/lib/search";
import type { Context } from "@peated/server/orpc/context";
import { bottleNormalize } from "@peated/server/orpc/routes/bottles/validation";
import type { BottleInputSchema } from "@peated/server/schemas";
import type { BottlePreviewResult } from "@peated/server/types";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  findConflictingSmwsBottleId,
  getSmwsCodeForBottleIdentity,
} from "./bottleConflicts";
import { materializeBottleIdentity } from "./bottleIdentity";
import { releaseYearFromDate } from "./bottleRelease";
import {
  BottleCreateInputSchema,
  type BottleCreateInput,
} from "./bottleSchemas";

export { BottleCreateInputSchema } from "./bottleSchemas";
export type { BottleCreateInput } from "./bottleSchemas";

export class BottleCreateBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleCreateBadRequestError";
  }
}

export class BottleAlreadyExistsError extends Error {
  constructor(
    readonly bottleId: number,
    readonly collision: {
      kind: "alias" | "canonical_name" | "smws_code";
      attemptedCanonicalFullName: string | null;
      attemptedSmwsCode?: string | null;
    } | null = null,
  ) {
    super("Bottle already exists.");
    this.name = "BottleAlreadyExistsError";
  }
}

type PersistedBottleResult = {
  bottle: Bottle;
  newAliases: string[];
  newEntityIds: number[];
  seriesCreated: boolean;
};

type PreparedBottleCreate = {
  bottleInsertData: NewBottle;
  creationSource: CatalogVerificationCreationSource;
  createdByActorId: number;
  distillerIds: number[];
  newEntityIds: number[];
  seriesCreated: boolean;
  groupFullName: string;
  groupName: string;
};

type BottleIdentityPreparation = {
  exactNormalizedFields: Pick<
    BottleCreateInput,
    | "statedAge"
    | "vintageYear"
    | "bottlingYear"
    | "releaseYear"
    | "singleCask"
    | "caskStrength"
  >;
  groupName: string;
  groupStatedAge: number | null;
};

type BottleGroupCreateInput = Pick<
  BottleCreateInput,
  | "name"
  | "series"
  | "category"
  | "brand"
  | "distillers"
  | "bottler"
  | "flavorProfile"
> & { statedAge: number | null };

type ExactBottleCreateInput = Pick<
  BottleCreateInput,
  | "edition"
  | "statedAge"
  | "noAgeStatement"
  | "abv"
  | "singleCask"
  | "caskStrength"
  | "naturalColor"
  | "nonChillFiltered"
  | "maltPhenolPpm"
  | "vintageYear"
  | "bottlingYear"
  | "releaseYear"
  | "releaseDate"
  | "maturation"
  | "caskNumber"
  | "outturn"
  | "description"
  | "descriptionSrc"
  | "tastingNotes"
>;

interface SplitBottleCreateInput {
  group: BottleGroupCreateInput;
  exact: ExactBottleCreateInput;
}

/** The server owns storage scope. New singleton groups have no shared age. */
function splitBottleCreateInput(
  input: BottleCreateInput,
): SplitBottleCreateInput {
  const {
    name,
    series,
    category,
    brand,
    distillers,
    bottler,
    flavorProfile,
    ...exact
  } = input;
  return {
    group: {
      name,
      statedAge: null,
      series,
      category,
      brand,
      distillers,
      bottler,
      flavorProfile,
    },
    exact,
  };
}

export type BottleCreateResult = PersistedBottleResult & {
  group: BottleGroup;
};

/** Resolves entities and materializes the complete Bottle insert. */
async function prepareBottleCreateInTransaction(
  tx: AnyTransaction,
  {
    creationSource = "manual_entry",
    bottleIdentity,
    createdByActorId,
    input,
  }: {
    creationSource?: CatalogVerificationCreationSource;
    bottleIdentity?: BottleIdentityPreparation;
    createdByActorId: number;
    input: z.infer<typeof BottleInputSchema>;
  },
): Promise<PreparedBottleCreate> {
  const actorId = createdByActorId;
  const bottleData: BottlePreviewResult & Partial<typeof bottles.$inferInsert> =
    await bottleNormalize({ input, entityDb: tx });
  if (bottleIdentity) {
    // Explicit exact input overrides traits inferred from the group name.
    Object.assign(bottleData, bottleIdentity.exactNormalizedFields);
  }
  if (bottleData.releaseDate) {
    bottleData.releaseYear = releaseYearFromDate(bottleData.releaseDate);
  }

  if (input.description !== undefined) {
    bottleData.description = input.description;
    bottleData.descriptionSrc =
      input.descriptionSrc ||
      (input.description && input.description !== null ? "user" : null);
  }

  const groupName = stripDuplicateBrandPrefixFromBottleName(
    bottleIdentity?.groupName ?? bottleData.name,
    bottleData.brand.name,
  );

  if (!groupName) {
    throw new BottleCreateBadRequestError("Invalid bottle name.");
  }

  if (bottleNameDuplicatesBrand(groupName, bottleData.brand.name)) {
    throw new BottleCreateBadRequestError(
      "Bottle name must identify an expression distinct from the brand.",
    );
  }

  const newEntityIds: Set<number> = new Set();
  let seriesCreated = false;

  const attemptedSmwsIdentity = {
    name: bottleData.name,
    fullName: formatBottleName({
      ...bottleData,
      name: `${bottleData.brand.shortName || bottleData.brand.name} ${bottleData.name}`,
    }),
    brand: bottleData.brand,
    bottler: bottleData.bottler ?? null,
  };
  const attemptedSmwsCode = getSmwsCodeForBottleIdentity(attemptedSmwsIdentity);
  const existingSmwsBottleId = await findConflictingSmwsBottleId(
    tx,
    attemptedSmwsIdentity,
  );
  if (existingSmwsBottleId) {
    throw new BottleAlreadyExistsError(existingSmwsBottleId, {
      kind: "smws_code",
      attemptedCanonicalFullName: null,
      attemptedSmwsCode,
    });
  }

  const brandUpsert = await upsertEntity({
    db: tx,
    data: coerceToUpsert(bottleData.brand),
    creationSource,
    type: "brand",
    createdByActorId: actorId,
  });

  if (!brandUpsert) {
    throw new BottleCreateBadRequestError("Could not identify brand.");
  }
  if (brandUpsert.created) newEntityIds.add(brandUpsert.id);

  const brand = brandUpsert.result;

  let bottler: Entity | null = null;
  if (bottleData.bottler) {
    const bottlerUpsert = await upsertEntity({
      db: tx,
      data: coerceToUpsert(bottleData.bottler),
      creationSource,
      type: "bottler",
      createdByActorId: actorId,
    });
    if (!bottlerUpsert) {
      throw new BottleCreateBadRequestError("Could not identify bottler.");
    }
    if (bottlerUpsert.created) newEntityIds.add(bottlerUpsert.id);
    bottler = bottlerUpsert.result;
  }

  let seriesId: number | null = null;
  if (input.series) {
    [seriesId, seriesCreated] = await processSeries({
      series: input.series,
      brand,
      createdByActorId: actorId,
      tx,
    });

    if (!seriesCreated && seriesId) {
      await tx
        .update(bottleSeries)
        .set({
          numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${seriesId}) + 1`,
        })
        .where(eq(bottleSeries.id, seriesId));
    }
  }

  const distillerIds: number[] = [];
  if (bottleData.distillers) {
    for (const distData of bottleData.distillers) {
      const distUpsert = await upsertEntity({
        db: tx,
        data: coerceToUpsert(distData),
        creationSource,
        createdByActorId: actorId,
        type: "distiller",
      });
      if (!distUpsert) {
        throw new BottleCreateBadRequestError("Could not identify distiller.");
      }
      if (distUpsert.created) newEntityIds.add(distUpsert.id);
      distillerIds.push(distUpsert.id);
    }
  }

  const groupFullName = formatBottleName({
    name: `${brand.shortName || brand.name} ${groupName}`,
  });
  const bottleName = bottleIdentity
    ? materializeBottleIdentity({
        stable: {
          name: groupName,
          fullName: groupFullName,
          statedAge: bottleIdentity.groupStatedAge,
        },
        exact: {
          edition: bottleData.edition ?? null,
          statedAge: bottleData.statedAge ?? null,
          noAgeStatement: bottleData.noAgeStatement ?? null,
          bottlingYear: bottleData.bottlingYear ?? null,
          releaseYear: bottleData.releaseYear ?? null,
          vintageYear: bottleData.vintageYear ?? null,
          abv: bottleData.abv ?? null,
          singleCask: bottleData.singleCask ?? null,
          caskStrength: bottleData.caskStrength ?? null,
          maturation: bottleData.maturation ?? null,
          caskNumber: bottleData.caskNumber ?? null,
          outturn: bottleData.outturn ?? null,
        },
      })
    : null;
  const fullName =
    bottleName?.fullName ??
    formatBottleName({
      ...bottleData,
      name: `${brand.shortName || brand.name} ${bottleData.name}`,
    });

  const bottleInsertData: NewBottle = {
    ...bottleData,
    name: bottleName?.name ?? bottleData.name,
    statedAge: bottleName ? bottleName.statedAge : bottleData.statedAge,
    brandId: brand.id,
    bottlerId: bottler?.id || null,
    seriesId,
    createdByActorId: actorId,
    fullName,
  };
  bottleInsertData.searchVector = buildBottleSearchVector(
    bottleInsertData,
    brand,
  );

  return {
    bottleInsertData,
    creationSource,
    createdByActorId: actorId,
    distillerIds,
    newEntityIds: Array.from(newEntityIds),
    seriesCreated,
    groupFullName,
    groupName,
  };
}

function mapExactBottleAliasConflict(
  error: ExactBottleAliasConflictError,
  attemptedCanonicalFullName: string,
) {
  if (error.conflictingBottleId === null) return error;

  return new BottleAlreadyExistsError(error.conflictingBottleId, {
    kind:
      error.alias.assignmentSource === "canonical" &&
      error.alias.ignored !== true
        ? "canonical_name"
        : "alias",
    attemptedCanonicalFullName,
  });
}

async function reserveCanonicalBottleAliasesInTransaction(
  tx: AnyTransaction,
  {
    bottle,
    assignedByActorId,
  }: {
    bottle: Bottle;
    assignedByActorId: number;
  },
) {
  const changedAliasNames = new Set<string>();
  const reserveAlias = async (
    reserve: typeof reserveExactBottleAliasInTransaction,
  ) => {
    try {
      const result = await reserve(tx, {
        name: bottle.fullName,
        bottleId: bottle.id,
        assignmentSource: "canonical",
        assignedByActorId,
      });
      if (result.changed) changedAliasNames.add(result.name);
    } catch (error) {
      if (error instanceof ExactBottleAliasConflictError) {
        throw mapExactBottleAliasConflict(error, bottle.fullName);
      }
      throw error;
    }
  };

  await reserveAlias(reserveExactBottleAliasInTransaction);
  await reserveAlias(reserveLiteralCanonicalBottleAliasInTransaction);

  return Array.from(changedAliasNames).sort();
}

/** Persists the Bottle, its durable distiller joins, alias, and audit rows. */
async function insertPreparedBottleInTransaction(
  tx: AnyTransaction,
  prepared: PreparedBottleCreate,
  { groupId = null }: { groupId?: number | null } = {},
): Promise<PersistedBottleResult> {
  const {
    bottleInsertData,
    creationSource,
    createdByActorId,
    distillerIds,
    newEntityIds,
    seriesCreated,
  } = prepared;

  const [bottle] = await tx
    .insert(bottles)
    .values({ ...bottleInsertData, groupId })
    .returning();

  const newAliases = await reserveCanonicalBottleAliasesInTransaction(tx, {
    bottle,
    assignedByActorId: createdByActorId,
  });

  const promises: Promise<any>[] = [
    tx.insert(changes).values({
      objectType: "bottle",
      objectId: bottle.id,
      createdAt: bottle.createdAt,
      actorId: createdByActorId,
      displayName: bottle.fullName,
      type: "add",
      data: {
        ...bottle,
        distillerIds,
        catalogVerification:
          getCatalogVerificationCreationMetadata(creationSource),
      },
    }),
  ];

  for (const distillerId of distillerIds) {
    promises.push(
      tx.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId,
      }),
    );
  }

  await Promise.all(promises);

  return {
    bottle,
    newAliases,
    newEntityIds,
    seriesCreated,
  };
}

function buildBottleInput(
  group: BottleGroupCreateInput,
  exact: ExactBottleCreateInput,
): z.infer<typeof BottleInputSchema> {
  const input: z.infer<typeof BottleInputSchema> = {
    name: group.name,
    imageUrl: null,
    brand: group.brand,
    distillers: group.distillers,
    bottler: group.bottler,
    series: group.series,
    category: group.category,
    flavorProfile: group.flavorProfile,
    ...exact,
  };
  return input;
}

/** Creates the group-owned rows inside the complete independent operation. */
async function createIndependentGroupPrefix(
  tx: AnyTransaction,
  {
    actorId,
    fields,
    groupFullName,
    groupName,
    brandId,
    bottlerId,
    seriesId,
    category,
    flavorProfile,
    distillerIds,
  }: {
    actorId: number;
    fields: BottleGroupCreateInput;
    groupFullName: string;
    groupName: string;
    brandId: number;
    bottlerId: number | null;
    seriesId: number | null;
    category: (typeof bottleGroups.$inferInsert)["category"];
    flavorProfile: (typeof bottleGroups.$inferInsert)["flavorProfile"];
    distillerIds: number[];
  },
) {
  const [group] = await tx
    .insert(bottleGroups)
    .values({
      fullName: groupFullName,
      name: groupName,
      statedAge: fields.statedAge,
      seriesId,
      category,
      brandId,
      bottlerId,
      flavorProfile,
      totalBottles: 1,
      createdByActorId: actorId,
    })
    .returning();

  if (distillerIds.length) {
    await tx.insert(bottleGroupDistillers).values(
      distillerIds.map((distillerId) => ({
        groupId: group.id,
        distillerId,
      })),
    );
  }

  return group;
}

/** Owns the complete singleton Bottle graph transaction. */
export async function createBottleInTransaction(
  tx: AnyTransaction,
  {
    creationSource = "manual_entry",
    createdByActorId,
    input,
  }: {
    creationSource?: CatalogVerificationCreationSource;
    createdByActorId: number;
    input: BottleCreateInput;
  },
): Promise<BottleCreateResult> {
  const { group: storageGroup, exact } = splitBottleCreateInput(input);
  // Exact age is name-normalization context only; it cannot become group-owned state.
  const normalizedGroup = normalizeBottleAge({
    name: normalizeBottleAliasKey(storageGroup.name),
    statedAge: exact.statedAge,
  });
  const groupFields = {
    ...storageGroup,
    name: normalizedGroup.name,
  };
  const prepared = await prepareBottleCreateInTransaction(tx, {
    creationSource,
    bottleIdentity: {
      exactNormalizedFields: {
        statedAge: exact.statedAge,
        vintageYear: exact.vintageYear,
        bottlingYear: exact.bottlingYear,
        releaseYear: exact.releaseYear,
        singleCask: exact.singleCask,
        caskStrength: exact.caskStrength,
      },
      groupName: groupFields.name,
      groupStatedAge: groupFields.statedAge,
    },
    createdByActorId,
    input: buildBottleInput(groupFields, exact),
  });

  const group = await createIndependentGroupPrefix(tx, {
    actorId: createdByActorId,
    fields: groupFields,
    groupFullName: prepared.groupFullName,
    groupName: prepared.groupName,
    brandId: prepared.bottleInsertData.brandId,
    bottlerId: prepared.bottleInsertData.bottlerId ?? null,
    seriesId: prepared.bottleInsertData.seriesId ?? null,
    category: prepared.bottleInsertData.category,
    flavorProfile: prepared.bottleInsertData.flavorProfile,
    distillerIds: prepared.distillerIds,
  });

  const bottleResult = await insertPreparedBottleInTransaction(tx, prepared, {
    groupId: group.id,
  });

  const [persistedGroup] = await tx
    .update(bottleGroups)
    .set({ representativeBottleId: bottleResult.bottle.id })
    .where(eq(bottleGroups.id, group.id))
    .returning();

  return {
    ...bottleResult,
    group: persistedGroup,
  };
}

export type BottleCreateOrReuseResult = {
  bottle: Bottle;
  createResult: BottleCreateResult | null;
};

function isSafeBottleReuse(
  error: BottleAlreadyExistsError,
  existingBottle: Bottle,
) {
  if (
    error.collision?.kind === "canonical_name" &&
    error.collision.attemptedCanonicalFullName !== null
  ) {
    return (
      existingBottle.fullName === error.collision.attemptedCanonicalFullName
    );
  }

  if (
    error.collision?.kind !== "smws_code" ||
    !error.collision.attemptedSmwsCode
  ) {
    return false;
  }

  return [existingBottle.name, existingBottle.fullName].some(
    (name) =>
      parseSmwsReferenceName(name)?.code === error.collision!.attemptedSmwsCode,
  );
}

/**
 * Owns the savepoint-backed create-or-safe-reuse decision. Reuse is
 * limited to an exact canonical-name collision or the structurally verified
 * SMWS code that caused creation to conflict.
 */
export async function createOrReuseBottleInTransaction(
  tx: AnyTransaction,
  {
    creationSource,
    createdByActorId,
    input,
  }: {
    creationSource: CatalogVerificationCreationSource;
    createdByActorId: number;
    input: BottleCreateInput;
  },
): Promise<BottleCreateOrReuseResult> {
  try {
    const createResult = await tx.transaction(async (creationTx) =>
      createBottleInTransaction(creationTx, {
        creationSource,
        createdByActorId,
        input,
      }),
    );
    return {
      bottle: createResult.bottle,
      createResult,
    };
  } catch (error) {
    if (!(error instanceof BottleAlreadyExistsError)) throw error;

    await resolveActiveBottleIds(tx, [error.bottleId], { lock: "update" });

    const existingBottle = await tx.query.bottles.findFirst({
      where: eq(bottles.id, error.bottleId),
    });
    if (!existingBottle || !isSafeBottleReuse(error, existingBottle)) {
      throw error;
    }

    return {
      bottle: existingBottle,
      createResult: null,
    };
  }
}

/** Dispatches unique, best-effort work only after the Bottle transaction commits. */
export async function finalizeCreatedBottle(
  { bottle, seriesCreated, newAliases, newEntityIds }: BottleCreateResult,
  {
    creationSource = "manual_entry",
  }: {
    creationSource?: CatalogVerificationCreationSource;
  } = {},
) {
  try {
    await pushUniqueJob("OnBottleChange", {
      bottleId: bottle.id,
      generateDetails: true,
    });
  } catch (err) {
    logError(err, {
      bottle: {
        id: bottle.id,
      },
    });
  }

  try {
    await queueBottleCreationVerification({
      bottleId: bottle.id,
      creationSource,
    });
  } catch (err) {
    logError(err, {
      bottle: {
        id: bottle.id,
      },
    });
  }

  if (bottle.seriesId && seriesCreated) {
    try {
      await pushUniqueJob("IndexBottleSeriesSearchVectors", {
        seriesId: bottle.seriesId,
      });
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottle.id,
        },
        series: {
          id: bottle.seriesId,
        },
      });
    }
  }

  for (const aliasName of newAliases) {
    try {
      await pushUniqueJob("OnBottleAliasChange", { name: aliasName });
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottle.id,
        },
      });
    }
  }

  for (const entityId of newEntityIds) {
    try {
      await pushUniqueJob("OnEntityChange", { entityId });
    } catch (err) {
      logError(err, {
        entity: {
          id: entityId,
        },
      });
    }

    try {
      await queueEntityCreationVerification({
        entityId,
        creationSource,
      });
    } catch (err) {
      logError(err, {
        entity: {
          id: entityId,
        },
      });
    }
  }
}

export type CreateBottleResult = Pick<BottleCreateResult, "bottle" | "group">;
type BottleCreateInputCandidate = Partial<
  z.input<typeof BottleCreateInputSchema>
>;

/** Actor resolution stays outside this transaction and post-commit boundary. */
async function createBottleForActor({
  actorId,
  creationSource,
  input: rawInput,
}: {
  actorId: number;
  creationSource: CatalogVerificationCreationSource;
  input: BottleCreateInputCandidate;
}): Promise<CreateBottleResult> {
  const input = BottleCreateInputSchema.parse(rawInput);
  const result = await db.transaction(async (tx) =>
    createBottleInTransaction(tx, {
      creationSource,
      createdByActorId: actorId,
      input,
    }),
  );

  await finalizeCreatedBottle(result, { creationSource });
  return {
    bottle: result.bottle,
    group: result.group,
  };
}

/** Parses untrusted input once and owns transaction plus post-commit dispatch. */
export async function createBottle({
  creationSource = "manual_entry",
  input,
  context,
}: {
  creationSource?: CatalogVerificationCreationSource;
  input: BottleCreateInputCandidate;
  context: Context & { user: User };
}): Promise<CreateBottleResult> {
  const actor = await getUserActor(context.user);
  return createBottleForActor({ actorId: actor.id, creationSource, input });
}

/** Trusted scraper capability; automated creation is always Peated-owned. */
export async function createBottleAsPeated(
  input: BottleCreateInputCandidate,
): Promise<CreateBottleResult> {
  const actor = await getPeatedSystemActor();
  return createBottleForActor({
    actorId: actor.id,
    creationSource: "manual_entry",
    input,
  });
}
