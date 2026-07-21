/**
 * Shares preparation and persistence across complete legacy and concrete Bottle
 * transactions. Stable fields and distiller joins are durable parts of each
 * concrete Bottle's independently renderable identity.
 */
import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleAliasKey,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import { type CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import type { AnyTransaction } from "@peated/server/db";
import type {
  Bottle,
  BottleGroup,
  CatalogTarget,
  Entity,
  NewBottle,
  User,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTombstones,
  catalogTargets,
  changes,
} from "@peated/server/db/schema";
import { reserveExactBottleAliasInTransaction } from "@peated/server/lib/bottleAliases";
import { processSeries } from "@peated/server/lib/bottleHelpers";
import {
  lockCatalogTargetAssignmentDescriptorInTransaction,
  lockCatalogTargetAssignmentDescriptorsInTransaction,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
} from "@peated/server/lib/catalogTargets";
import {
  getCatalogVerificationCreationMetadata,
  queueBottleCreationVerification,
  queueEntityCreationVerification,
} from "@peated/server/lib/catalogVerification";
import {
  coerceToUpsert,
  upsertBottleAlias,
  upsertEntity,
} from "@peated/server/lib/db";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import type { Context } from "@peated/server/orpc/context";
import { bottleNormalize } from "@peated/server/orpc/routes/bottles/validation";
import type { BottleInputSchema } from "@peated/server/schemas";
import type { BottlePreviewResult } from "@peated/server/types";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  findConflictingSmwsBottleId,
  getSmwsCodeForBottleIdentity,
} from "./concreteBottleConflicts";
import { materializeConcreteBottleIdentity } from "./concreteBottleIdentity";
import type { ConcreteBottleCreateInput } from "./concreteBottleSchemas";

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

export type CreateBottleResult = {
  bottle: Bottle;
  newAliases: string[];
  newEntityIds: number[];
  seriesCreated: boolean;
};

type PreparedBottleCreate = {
  aliasName: string;
  bottleInsertData: NewBottle;
  creationSource: CatalogVerificationCreationSource;
  createdByActorId: number;
  distillerIds: number[];
  newEntityIds: number[];
  seriesCreated: boolean;
  stableFullName: string;
  stableName: string;
};

type ConcreteIdentityPreparation = {
  exactNormalizedFields: Pick<
    ConcreteBottleCreateInput["exact"],
    "statedAge" | "vintageYear" | "releaseYear" | "singleCask" | "caskStrength"
  >;
  stableBase:
    | { kind: "independent"; name: string }
    | { kind: "trusted"; fullName: string; name: string };
  stableStatedAge: number | null;
};

type IndependentConcreteBottleCreateInput = Extract<
  ConcreteBottleCreateInput,
  { kind: "independent" }
>;
type StableBottleGroupInput = IndependentConcreteBottleCreateInput["stable"];

export type LikelyBottleGroupSuggestion = Pick<
  BottleGroup,
  "id" | "name" | "fullName"
>;

export type ConcreteBottleCreateResult = CreateBottleResult & {
  group: BottleGroup;
  genericTarget: CatalogTarget;
  exactTarget: CatalogTarget;
  likelyGroups: LikelyBottleGroupSuggestion[];
};

export type TrustedSourceBottleErrorCode =
  | "not_found"
  | "retired"
  | "invalid_catalog_graph";

export class TrustedSourceBottleError extends Error {
  constructor(
    readonly code: TrustedSourceBottleErrorCode,
    readonly sourceBottleId: number,
  ) {
    super(`Cannot reuse Bottle ${sourceBottleId}: ${code}.`);
    this.name = "TrustedSourceBottleError";
  }
}

async function getExistingBottleForAlias(
  tx: AnyTransaction,
  aliasName: string,
): Promise<{
  bottleId: number;
  ignored: boolean | null;
  assignmentSource: (typeof bottleAliases.$inferSelect)["assignmentSource"];
} | null> {
  const [result] = await tx
    .select({
      bottleId: bottleAliases.bottleId,
      ignored: bottleAliases.ignored,
      assignmentSource: bottleAliases.assignmentSource,
    })
    .from(bottleAliases)
    .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()))
    .limit(1);

  return result?.bottleId ? { ...result, bottleId: result.bottleId } : null;
}

/** Writes prerequisites and reserves the alias for same-transaction Bottle insertion. */
async function prepareBottleCreateInTransaction(
  tx: AnyTransaction,
  {
    creationSource = "manual_entry",
    concreteIdentity,
    createdByActorId,
    input,
    context,
  }: {
    creationSource?: CatalogVerificationCreationSource;
    concreteIdentity?: ConcreteIdentityPreparation;
    createdByActorId: number;
    input: z.infer<typeof BottleInputSchema>;
    context: Context & { user: User };
  },
): Promise<PreparedBottleCreate> {
  const user = context.user;
  const actorId = createdByActorId;
  const bottleData: BottlePreviewResult & Record<string, any> =
    await bottleNormalize({ input, context, entityDb: tx });
  if (concreteIdentity) {
    // Explicit exact input overrides traits inferred from the stable name.
    Object.assign(bottleData, concreteIdentity.exactNormalizedFields);
  }

  if (input.description !== undefined) {
    bottleData.description = input.description;
    bottleData.descriptionSrc =
      input.descriptionSrc ||
      (input.description && input.description !== null ? "user" : null);
  }

  const stableName =
    concreteIdentity?.stableBase.kind === "trusted"
      ? concreteIdentity.stableBase.name
      : stripDuplicateBrandPrefixFromBottleName(
          concreteIdentity?.stableBase.name ?? bottleData.name,
          bottleData.brand.name,
        );

  if (!stableName) {
    throw new BottleCreateBadRequestError("Invalid bottle name.");
  }

  if (bottleNameDuplicatesBrand(stableName, bottleData.brand.name)) {
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
    userId: user.id,
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
      userId: user.id,
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
      userId: user.id,
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
        userId: user.id,
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

  const stableFullName =
    (concreteIdentity?.stableBase.kind === "trusted"
      ? concreteIdentity.stableBase.fullName
      : null) ??
    formatBottleName({
      name: `${brand.shortName || brand.name} ${stableName}`,
    });
  const concreteName = concreteIdentity
    ? materializeConcreteBottleIdentity({
        stable: {
          name: stableName,
          fullName: stableFullName,
          statedAge: concreteIdentity.stableStatedAge,
        },
        exact: {
          edition: bottleData.edition ?? null,
          statedAge: bottleData.statedAge ?? null,
          releaseYear: bottleData.releaseYear ?? null,
          vintageYear: bottleData.vintageYear ?? null,
          abv: bottleData.abv ?? null,
          singleCask: bottleData.singleCask ?? null,
          caskStrength: bottleData.caskStrength ?? null,
          caskType: bottleData.caskType ?? null,
          caskSize: bottleData.caskSize ?? null,
          caskFill: bottleData.caskFill ?? null,
        },
      })
    : null;
  const fullName =
    concreteName?.fullName ??
    formatBottleName({
      ...bottleData,
      name: `${brand.shortName || brand.name} ${bottleData.name}`,
    });

  const bottleInsertData: NewBottle = {
    ...bottleData,
    name: concreteName?.name ?? bottleData.name,
    statedAge: concreteName ? concreteName.statedAge : bottleData.statedAge,
    brandId: brand.id,
    bottlerId: bottler?.id || null,
    seriesId,
    createdByActorId: actorId,
    fullName,
  };

  const alias = await upsertBottleAlias(
    tx,
    bottleInsertData.fullName,
    null,
    null,
    {
      assignedByActorId: actorId,
    },
  );
  if (alias.bottleId) {
    throw new BottleAlreadyExistsError(alias.bottleId, {
      kind:
        alias.assignmentSource === "canonical" && alias.ignored !== true
          ? "canonical_name"
          : "alias",
      attemptedCanonicalFullName: bottleInsertData.fullName,
    });
  }

  return {
    aliasName: alias.name,
    bottleInsertData,
    creationSource,
    createdByActorId: actorId,
    distillerIds,
    newEntityIds: Array.from(newEntityIds),
    seriesCreated,
    stableFullName,
    stableName,
  };
}

/** Persists the Bottle, its durable distiller joins, alias, and audit rows. */
async function insertPreparedBottleInTransaction(
  tx: AnyTransaction,
  prepared: PreparedBottleCreate,
  { groupId = null }: { groupId?: number | null } = {},
): Promise<CreateBottleResult> {
  const {
    aliasName,
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

  const [newAlias] = await tx
    .update(bottleAliases)
    .set({
      bottleId: bottle.id,
      assignmentSource: "canonical",
      assignedByActorId: createdByActorId,
    })
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()),
        isNull(bottleAliases.bottleId),
      ),
    )
    .returning();

  if (!newAlias) {
    const existingAlias = await getExistingBottleForAlias(tx, aliasName);
    if (existingAlias && existingAlias.bottleId !== bottle.id) {
      throw new BottleAlreadyExistsError(existingAlias.bottleId, {
        kind:
          existingAlias.assignmentSource === "canonical" &&
          existingAlias.ignored !== true
            ? "canonical_name"
            : "alias",
        attemptedCanonicalFullName: bottleInsertData.fullName,
      });
    }
    throw new Error("Failed to finalize bottle alias.");
  }

  if (newAlias.bottleId && newAlias.bottleId !== bottle.id) {
    throw new BottleAlreadyExistsError(newAlias.bottleId, {
      kind: "canonical_name",
      attemptedCanonicalFullName: bottleInsertData.fullName,
    });
  }

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
    newAliases: [aliasName],
    newEntityIds,
    seriesCreated,
  };
}

type TrustedGroupContext = {
  group: BottleGroup;
  genericTarget: CatalogTarget;
  distillerIds: number[];
};

/** Locks the trusted graph in Group -> Bottle -> CatalogTarget order. */
async function loadTrustedGroupContext(
  tx: AnyTransaction,
  sourceBottleId: number,
): Promise<TrustedGroupContext> {
  const [discoveredSource] = await tx
    .select({ groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, sourceBottleId))
    .limit(1);

  if (!discoveredSource) {
    throw new TrustedSourceBottleError("not_found", sourceBottleId);
  }
  if (!discoveredSource.groupId) {
    throw new TrustedSourceBottleError("invalid_catalog_graph", sourceBottleId);
  }

  const [group] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, discoveredSource.groupId))
    .for("update");
  if (!group) {
    throw new TrustedSourceBottleError("invalid_catalog_graph", sourceBottleId);
  }

  const [sourceBottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, sourceBottleId))
    .for("update");
  if (!sourceBottle) {
    throw new TrustedSourceBottleError("not_found", sourceBottleId);
  }

  const retiredBottle = await tx.query.bottleTombstones.findFirst({
    where: eq(bottleTombstones.bottleId, sourceBottleId),
    columns: { bottleId: true },
  });
  if (retiredBottle) {
    throw new TrustedSourceBottleError("retired", sourceBottleId);
  }
  if (sourceBottle.groupId !== group.id) {
    throw new TrustedSourceBottleError("invalid_catalog_graph", sourceBottleId);
  }

  const retiredGroup = await tx.query.bottleGroupTombstones.findFirst({
    where: eq(bottleGroupTombstones.groupId, group.id),
    columns: { groupId: true },
  });
  if (retiredGroup) {
    throw new TrustedSourceBottleError("retired", sourceBottleId);
  }

  const targets = await tx
    .select()
    .from(catalogTargets)
    .where(
      and(
        eq(catalogTargets.groupId, group.id),
        or(
          isNull(catalogTargets.bottleId),
          eq(catalogTargets.bottleId, sourceBottleId),
        ),
      ),
    )
    .orderBy(asc(catalogTargets.id))
    .for("update");
  const genericTarget = targets.find((target) => target.bottleId === null);
  const sourceExactTarget = targets.find(
    (target) => target.bottleId === sourceBottleId,
  );

  if (!genericTarget || !sourceExactTarget) {
    throw new TrustedSourceBottleError("invalid_catalog_graph", sourceBottleId);
  }

  const distillers = await tx
    .select({ distillerId: bottleGroupDistillers.distillerId })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, group.id))
    .orderBy(asc(bottleGroupDistillers.distillerId));

  return {
    group,
    genericTarget,
    distillerIds: distillers.map(({ distillerId }) => distillerId),
  };
}

async function findLikelyGroups(
  tx: AnyTransaction,
  { brandId, name }: { brandId: number; name: string },
): Promise<LikelyBottleGroupSuggestion[]> {
  return await tx
    .select({
      id: bottleGroups.id,
      name: bottleGroups.name,
      fullName: bottleGroups.fullName,
    })
    .from(bottleGroups)
    .leftJoin(
      bottleGroupTombstones,
      eq(bottleGroupTombstones.groupId, bottleGroups.id),
    )
    .where(
      and(
        eq(bottleGroups.brandId, brandId),
        eq(sql`LOWER(${bottleGroups.name})`, name.toLowerCase()),
        isNull(bottleGroupTombstones.groupId),
      ),
    )
    .orderBy(asc(bottleGroups.id))
    .limit(5);
}

function buildConcreteBottleInput(
  stable: StableBottleGroupInput,
  exact: ConcreteBottleCreateInput["exact"],
): z.infer<typeof BottleInputSchema> {
  const input: z.infer<typeof BottleInputSchema> = {
    name: stable.name,
    imageUrl: null,
    brand: stable.brand,
    distillers: stable.distillers,
    bottler: stable.bottler,
    series: stable.series,
    category: stable.category,
    flavorProfile: stable.flavorProfile,
    ...exact,
  };
  return input;
}

function buildTrustedStableInput(
  group: BottleGroup,
  distillerIds: number[],
): StableBottleGroupInput {
  return {
    name: group.name,
    statedAge: group.statedAge,
    series: group.seriesId,
    category: group.category,
    brand: group.brandId,
    distillers: distillerIds,
    bottler: group.bottlerId,
    flavorProfile: group.flavorProfile,
  };
}

/** Creates the group-owned rows inside the complete independent operation. */
async function createIndependentGroupPrefix(
  tx: AnyTransaction,
  {
    actorId,
    stable,
    stableFullName,
    stableName,
    brandId,
    bottlerId,
    seriesId,
    category,
    flavorProfile,
    distillerIds,
  }: {
    actorId: number;
    stable: StableBottleGroupInput;
    stableFullName: string;
    stableName: string;
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
      fullName: stableFullName,
      name: stableName,
      statedAge: stable.statedAge,
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

  const [genericTarget] = await tx
    .insert(catalogTargets)
    .values({ groupId: group.id })
    .returning();

  return { group, genericTarget };
}

/**
 * Owns the complete concrete Bottle graph transaction. Independent creation
 * always makes a singleton; trusted reuse derives authority from a source Bottle.
 */
export async function createConcreteBottleInTransaction(
  tx: AnyTransaction,
  {
    creationSource = "manual_entry",
    createdByActorId,
    input,
    context,
  }: {
    creationSource?: CatalogVerificationCreationSource;
    createdByActorId: number;
    input: ConcreteBottleCreateInput;
    context: Context & { user: User };
  },
): Promise<ConcreteBottleCreateResult> {
  const trustedContext =
    input.kind === "source_bottle"
      ? await loadTrustedGroupContext(tx, input.sourceBottleId)
      : null;
  const stableInput =
    input.kind === "source_bottle"
      ? buildTrustedStableInput(
          trustedContext!.group,
          trustedContext!.distillerIds,
        )
      : input.stable;
  // Exact age is name-normalization context only; it cannot become group-owned state.
  const normalizedStable = trustedContext
    ? null
    : normalizeBottleAge({
        name: normalizeBottleAliasKey(stableInput.name),
        statedAge: stableInput.statedAge ?? input.exact.statedAge,
      });
  const stable = normalizedStable
    ? { ...stableInput, name: normalizedStable.name }
    : stableInput;
  const prepared = await prepareBottleCreateInTransaction(tx, {
    creationSource,
    concreteIdentity: {
      exactNormalizedFields: {
        statedAge: input.exact.statedAge,
        vintageYear: input.exact.vintageYear,
        releaseYear: input.exact.releaseYear,
        singleCask: input.exact.singleCask,
        caskStrength: input.exact.caskStrength,
      },
      stableBase: trustedContext
        ? {
            kind: "trusted",
            fullName: trustedContext.group.fullName,
            name: trustedContext.group.name,
          }
        : { kind: "independent", name: stable.name },
      stableStatedAge: stable.statedAge,
    },
    createdByActorId,
    input: buildConcreteBottleInput(stable, input.exact),
    context,
  });

  const likelyGroups = trustedContext
    ? []
    : await findLikelyGroups(tx, {
        brandId: prepared.bottleInsertData.brandId,
        name: prepared.stableName,
      });

  const independentGraph = trustedContext
    ? null
    : await createIndependentGroupPrefix(tx, {
        actorId: createdByActorId,
        stable,
        stableFullName: prepared.stableFullName,
        stableName: prepared.stableName,
        brandId: prepared.bottleInsertData.brandId,
        bottlerId: prepared.bottleInsertData.bottlerId ?? null,
        seriesId: prepared.bottleInsertData.seriesId ?? null,
        category: prepared.bottleInsertData.category,
        flavorProfile: prepared.bottleInsertData.flavorProfile,
        distillerIds: prepared.distillerIds,
      });
  const group = trustedContext?.group ?? independentGraph!.group;
  const genericTarget =
    trustedContext?.genericTarget ?? independentGraph!.genericTarget;

  const bottleResult = await insertPreparedBottleInTransaction(tx, prepared, {
    groupId: group.id,
  });
  const [exactTarget] = await tx
    .insert(catalogTargets)
    .values({ groupId: group.id, bottleId: bottleResult.bottle.id })
    .returning();

  await reserveExactBottleAliasInTransaction(tx, {
    name: prepared.aliasName,
    bottleId: bottleResult.bottle.id,
    targetId: exactTarget.id,
    assignmentSource: "canonical",
    assignedByActorId: createdByActorId,
  });

  let persistedGroup: BottleGroup;
  if (trustedContext) {
    [persistedGroup] = await tx
      .update(bottleGroups)
      .set({
        totalBottles: sql`${bottleGroups.totalBottles} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(bottleGroups.id, group.id))
      .returning();
  } else {
    [persistedGroup] = await tx
      .update(bottleGroups)
      .set({ representativeBottleId: bottleResult.bottle.id })
      .where(eq(bottleGroups.id, group.id))
      .returning();
  }

  return {
    ...bottleResult,
    group: persistedGroup,
    genericTarget,
    exactTarget,
    likelyGroups,
  };
}

export type ConcreteBottleCreateOrReuseResult = {
  bottle: Bottle;
  target: CatalogTargetAssignmentDescriptor & { bottleId: number };
  createResult: ConcreteBottleCreateResult | null;
};

function isSafeConcreteBottleReuse(
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
 * Owns the savepoint-backed concrete create-or-safe-reuse decision. Reuse is
 * limited to an exact canonical-name collision or the structurally verified
 * SMWS code that caused creation to conflict. Source-Bottle input additionally
 * constrains reuse to the source's still-active group.
 */
export async function createOrReuseConcreteBottleInTransaction(
  tx: AnyTransaction,
  {
    creationSource,
    createdByActorId,
    input,
    context,
  }: {
    creationSource: CatalogVerificationCreationSource;
    createdByActorId: number;
    input: ConcreteBottleCreateInput;
    context: Context & { user: User };
  },
): Promise<ConcreteBottleCreateOrReuseResult> {
  try {
    const createResult = await tx.transaction(async (creationTx) =>
      createConcreteBottleInTransaction(creationTx, {
        creationSource,
        createdByActorId,
        input,
        context,
      }),
    );
    return {
      bottle: createResult.bottle,
      target: {
        targetId: createResult.exactTarget.id,
        groupId: createResult.group.id,
        bottleId: createResult.bottle.id,
      },
      createResult,
    };
  } catch (error) {
    if (!(error instanceof BottleAlreadyExistsError)) throw error;

    const existingTarget = await resolveCatalogTargetForAssignment(
      { kind: "bottle", bottleId: error.bottleId },
      tx,
    );
    if (existingTarget.bottleId === null) throw error;

    if (input.kind === "source_bottle") {
      const sourceTarget = await resolveCatalogTargetForAssignment(
        { kind: "bottle", bottleId: input.sourceBottleId },
        tx,
      );
      await lockCatalogTargetAssignmentDescriptorsInTransaction(tx, [
        sourceTarget,
        existingTarget,
      ]);
      if (sourceTarget.groupId !== existingTarget.groupId) throw error;
    } else {
      await lockCatalogTargetAssignmentDescriptorInTransaction(
        tx,
        existingTarget,
        { composition: "concrete_bottle_mutation" },
      );
    }

    const existingBottle = await tx.query.bottles.findFirst({
      where: eq(bottles.id, error.bottleId),
    });
    if (!existingBottle || !isSafeConcreteBottleReuse(error, existingBottle)) {
      throw error;
    }

    return {
      bottle: existingBottle,
      target: {
        ...existingTarget,
        bottleId: existingTarget.bottleId,
      },
      createResult: null,
    };
  }
}

/** Dispatches unique, best-effort work only after the Bottle transaction commits. */
export async function finalizeCreatedBottle(
  { bottle, seriesCreated, newAliases, newEntityIds }: CreateBottleResult,
  {
    creationSource = "manual_entry",
  }: {
    creationSource?: CatalogVerificationCreationSource;
  } = {},
) {
  try {
    await pushUniqueJob("OnBottleChange", { bottleId: bottle.id });
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
