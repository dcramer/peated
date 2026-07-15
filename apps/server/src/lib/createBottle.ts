/**
 * Shares preparation and persistence across complete legacy and concrete Bottle
 * transactions; no partial operation is exported. Concrete stable-field and
 * distiller mirrors remain for legacy readers until task 9.9.
 */
import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleAliasKey,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import { formatCanonicalReleaseName } from "@peated/bottle-classifier/releaseIdentity";
import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import { type CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import { db, type AnyTransaction } from "@peated/server/db";
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
  entities,
} from "@peated/server/db/schema";
import { processSeries } from "@peated/server/lib/bottleHelpers";
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
import { toTitleCase } from "@peated/server/lib/strings";
import type { Context } from "@peated/server/orpc/context";
import { bottleNormalize } from "@peated/server/orpc/routes/bottles/validation";
import type { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { BottlePreviewResult } from "@peated/server/types";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { getUserActor } from "./actors";
import type { ConcreteBottleCreateInput } from "./createConcreteBottle";

export class BottleCreateBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleCreateBadRequestError";
  }
}

export class BottleAlreadyExistsError extends Error {
  constructor(readonly bottleId: number) {
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

/** Concrete aliases include exact cask traits without changing legacy release display. */
function formatConcreteCaskIdentity({
  fullName,
  name,
  caskType,
  caskSize,
  caskFill,
}: {
  fullName: string;
  name: string;
  caskType: string | null | undefined;
  caskSize: string | null | undefined;
  caskFill: string | null | undefined;
}) {
  const caskBits = [
    caskType ? `${toTitleCase(caskType)} Cask` : null,
    caskSize ? toTitleCase(caskSize) : null,
    caskFill
      ? caskFill === "other"
        ? "Other Fill"
        : toTitleCase(caskFill)
      : null,
  ].filter((value): value is string => value !== null);

  if (!caskBits.length) {
    return { fullName, name };
  }

  return {
    fullName: [fullName, ...caskBits].join(" - "),
    name: [name, ...caskBits].join(" - "),
  };
}

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

type SmwsEntityName = {
  name: string;
  shortName?: string | null;
};

async function getExistingBottleIdForAlias(
  tx: AnyTransaction,
  aliasName: string,
): Promise<number | null> {
  const [result] = await tx
    .select({
      bottleId: bottleAliases.bottleId,
    })
    .from(bottleAliases)
    .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()))
    .limit(1);

  return result?.bottleId ?? null;
}

function getSmwsCodeFromValues(values: Array<string | null | undefined>) {
  for (const value of values) {
    const code = parseSmwsReferenceName(value)?.code;
    if (code) {
      return code;
    }
  }

  return null;
}

function valuesHaveSmwsCode(
  values: Array<string | null | undefined>,
  code: string,
) {
  return values.some((value) => parseSmwsReferenceName(value)?.code === code);
}

function entityNameVariants(
  entity: SmwsEntityName | null,
  name: string | null,
) {
  if (!entity || !name) {
    return [];
  }

  return [
    entity.shortName ? `${entity.shortName} ${name}` : null,
    `${entity.name} ${name}`,
  ];
}

function getSmwsCodeForBottleCreate({
  name,
  fullName,
  brand,
  bottler,
}: {
  name: string;
  fullName: string;
  brand: SmwsEntityName;
  bottler: SmwsEntityName | null;
}) {
  return getSmwsCodeFromValues([
    fullName,
    ...entityNameVariants(brand, name),
    ...entityNameVariants(bottler, name),
  ]);
}

function rowHasSmwsCode(
  row: {
    aliasName: string | null;
    bottleName: string;
    fullName: string;
    brandName: string | null;
    brandShortName: string | null;
    bottlerName: string | null;
    bottlerShortName: string | null;
  },
  code: string,
) {
  const brand = { name: row.brandName ?? "", shortName: row.brandShortName };
  const bottler = {
    name: row.bottlerName ?? "",
    shortName: row.bottlerShortName,
  };

  return valuesHaveSmwsCode(
    [
      row.aliasName,
      row.fullName,
      ...entityNameVariants(brand, row.bottleName),
      ...entityNameVariants(brand, row.aliasName),
      ...entityNameVariants(bottler, row.bottleName),
      ...entityNameVariants(bottler, row.aliasName),
    ],
    code,
  );
}

async function findExistingSmwsBottleIdForCreate(
  tx: AnyTransaction,
  {
    name,
    fullName,
    brand,
    bottler,
  }: {
    name: string;
    fullName: string;
    brand: SmwsEntityName;
    bottler: SmwsEntityName | null;
  },
): Promise<number | null> {
  const code = getSmwsCodeForBottleCreate({
    name,
    fullName,
    brand,
    bottler,
  });
  if (!code) {
    return null;
  }

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`smws:${code}`}))`,
  );

  const brandEntity = alias(entities, "smws_create_brand");
  const bottlerEntity = alias(entities, "smws_create_bottler");
  const codeSearch = `%${code}%`;
  const smwsSearch = "%SMWS%";
  const societySearch = "%Scotch Malt Whisky Society%";

  const rows = await tx
    .select({
      bottleId: bottles.id,
      bottleName: bottles.name,
      fullName: bottles.fullName,
      aliasName: bottleAliases.name,
      brandName: brandEntity.name,
      brandShortName: brandEntity.shortName,
      bottlerName: bottlerEntity.name,
      bottlerShortName: bottlerEntity.shortName,
    })
    .from(bottles)
    .innerJoin(brandEntity, eq(brandEntity.id, bottles.brandId))
    .leftJoin(bottlerEntity, eq(bottlerEntity.id, bottles.bottlerId))
    .leftJoin(
      bottleAliases,
      and(
        eq(bottleAliases.bottleId, bottles.id),
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
      ),
    )
    .where(
      and(
        sql`(
          ${bottles.name} ILIKE ${codeSearch}
          OR ${bottles.fullName} ILIKE ${codeSearch}
          OR ${bottleAliases.name} ILIKE ${codeSearch}
        )`,
        sql`(
          LOWER(${brandEntity.name}) IN ('smws', 'the scotch malt whisky society', 'scotch malt whisky society')
          OR LOWER(COALESCE(${brandEntity.shortName}, '')) = 'smws'
          OR LOWER(COALESCE(${bottlerEntity.name}, '')) IN ('smws', 'the scotch malt whisky society', 'scotch malt whisky society')
          OR LOWER(COALESCE(${bottlerEntity.shortName}, '')) = 'smws'
          OR ${bottles.fullName} ILIKE ${smwsSearch}
          OR ${bottles.fullName} ILIKE ${societySearch}
          OR ${bottleAliases.name} ILIKE ${smwsSearch}
          OR ${bottleAliases.name} ILIKE ${societySearch}
        )`,
      ),
    )
    .orderBy(bottles.id);

  return rows.find((row) => rowHasSmwsCode(row, code))?.bottleId ?? null;
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

  const existingSmwsBottleId = await findExistingSmwsBottleIdForCreate(tx, {
    name: bottleData.name,
    fullName: formatBottleName({
      ...bottleData,
      name: `${bottleData.brand.shortName || bottleData.brand.name} ${bottleData.name}`,
    }),
    brand: bottleData.brand,
    bottler: bottleData.bottler ?? null,
  });
  if (existingSmwsBottleId) {
    throw new BottleAlreadyExistsError(existingSmwsBottleId);
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
    ? formatConcreteCaskIdentity({
        ...formatCanonicalReleaseName({
          bottleName: stableName,
          bottleFullName: stableFullName,
          bottleReleaseTraits: {
            caskStrength: bottleData.caskStrength ?? null,
            singleCask: bottleData.singleCask ?? null,
          },
          bottleStatedAge: concreteIdentity.stableStatedAge,
          release: {
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
        }),
        caskType: bottleData.caskType,
        caskSize: bottleData.caskSize,
        caskFill: bottleData.caskFill,
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
    throw new BottleAlreadyExistsError(alias.bottleId);
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

/**
 * Persists Bottle and audit rows plus temporary legacy-reader mirrors inside a
 * complete transaction.
 */
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
    const existingBottleId = await getExistingBottleIdForAlias(tx, aliasName);
    if (existingBottleId && existingBottleId !== bottle.id) {
      throw new BottleAlreadyExistsError(existingBottleId);
    }
    throw new Error("Failed to finalize bottle alias.");
  }

  if (newAlias.bottleId && newAlias.bottleId !== bottle.id) {
    throw new BottleAlreadyExistsError(newAlias.bottleId);
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

/**
 * Creates all bottle-owned rows under a required actor id for write
 * attribution. Callers must resolve the actor before entering this helper.
 */
export async function createBottleInTransaction(
  tx: AnyTransaction,
  args: {
    creationSource?: CatalogVerificationCreationSource;
    createdByActorId: number;
    input: z.infer<typeof BottleInputSchema>;
    context: Context & { user: User };
  },
): Promise<CreateBottleResult> {
  const prepared = await prepareBottleCreateInTransaction(tx, args);
  return await insertPreparedBottleInTransaction(tx, prepared);
}

type TrustedGroupContext = {
  group: BottleGroup;
  genericTarget: CatalogTarget;
  distillerIds: number[];
};

/** Locks the trusted member and returns only a complete active group graph. */
async function loadTrustedGroupContext(
  tx: AnyTransaction,
  sourceBottleId: number,
): Promise<TrustedGroupContext> {
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

  if (!sourceBottle.groupId) {
    throw new TrustedSourceBottleError("invalid_catalog_graph", sourceBottleId);
  }

  const [group] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, sourceBottle.groupId))
    .for("update");

  const retiredGroup = await tx.query.bottleGroupTombstones.findFirst({
    where: eq(bottleGroupTombstones.groupId, sourceBottle.groupId),
    columns: { groupId: true },
  });
  if (retiredGroup) {
    throw new TrustedSourceBottleError("retired", sourceBottleId);
  }

  const targets = await tx
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, sourceBottle.groupId));
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
    .where(eq(bottleGroupDistillers.groupId, sourceBottle.groupId))
    .orderBy(asc(bottleGroupDistillers.distillerId));

  return {
    group: group!,
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
  const normalizedStable = trustedContext
    ? null
    : normalizeBottleAge({
        name: normalizeBottleAliasKey(stableInput.name),
        statedAge: stableInput.statedAge,
      });
  const stable = normalizedStable
    ? { ...stableInput, ...normalizedStable }
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

  const [targetedAlias] = await tx
    .update(bottleAliases)
    .set({ targetId: exactTarget.id })
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, prepared.aliasName.toLowerCase()),
        eq(bottleAliases.bottleId, bottleResult.bottle.id),
      ),
    )
    .returning({ name: bottleAliases.name });
  if (!targetedAlias) {
    throw new Error(
      "Failed to assign the canonical alias to its exact target.",
    );
  }

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

export async function createBottle({
  creationSource = "manual_entry",
  input,
  context,
}: {
  creationSource?: CatalogVerificationCreationSource;
  input: z.infer<typeof BottleInputSchema>;
  context: Context & { user: User };
}) {
  const actor = await getUserActor(context.user);
  const result = await db.transaction(async (tx) =>
    createBottleInTransaction(tx, {
      creationSource,
      createdByActorId: actor.id,
      input,
      context,
    }),
  );

  await finalizeCreatedBottle(result, { creationSource });

  return await serialize(BottleSerializer, result.bottle, context.user);
}
