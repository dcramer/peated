import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import { type CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle, Entity, NewBottle, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
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
import type { Context } from "@peated/server/orpc/context";
import { bottleNormalize } from "@peated/server/orpc/routes/bottles/validation";
import type { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { BottlePreviewResult } from "@peated/server/types";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";

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

export async function createBottleInTransaction(
  tx: AnyTransaction,
  {
    creationSource = "manual_entry",
    input,
    context,
  }: {
    creationSource?: CatalogVerificationCreationSource;
    input: z.infer<typeof BottleInputSchema>;
    context: Context & { user: User };
  },
): Promise<CreateBottleResult> {
  const user = context.user;
  const bottleData: BottlePreviewResult & Record<string, any> =
    await bottleNormalize({ input, context, entityDb: tx });

  if (input.description !== undefined) {
    bottleData.description = input.description;
    bottleData.descriptionSrc =
      input.descriptionSrc ||
      (input.description && input.description !== null ? "user" : null);
  }

  if (!bottleData.name) {
    throw new BottleCreateBadRequestError("Invalid bottle name.");
  }

  const newAliases: string[] = [];
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
        type: "distiller",
      });
      if (!distUpsert) {
        throw new BottleCreateBadRequestError("Could not identify distiller.");
      }
      if (distUpsert.created) newEntityIds.add(distUpsert.id);
      distillerIds.push(distUpsert.id);
    }
  }

  const fullName = formatBottleName({
    ...bottleData,
    name: `${brand.shortName || brand.name} ${bottleData.name}`,
  });

  const bottleInsertData: NewBottle = {
    ...bottleData,
    brandId: brand.id,
    bottlerId: bottler?.id || null,
    seriesId,
    createdById: user.id,
    fullName,
  };

  const alias = await upsertBottleAlias(tx, bottleInsertData.fullName);
  if (alias.bottleId) {
    throw new BottleAlreadyExistsError(alias.bottleId);
  }

  const [bottle] = await tx
    .insert(bottles)
    .values(bottleInsertData)
    .returning();

  const [newAlias] = await tx
    .update(bottleAliases)
    .set({
      bottleId: bottle.id,
      assignmentSource: "canonical",
      assignedById: user.id,
    })
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, alias.name.toLowerCase()),
        isNull(bottleAliases.bottleId),
      ),
    )
    .returning();

  if (!newAlias) {
    const existingBottleId = await getExistingBottleIdForAlias(tx, alias.name);
    if (existingBottleId && existingBottleId !== bottle.id) {
      throw new BottleAlreadyExistsError(existingBottleId);
    }
    throw new Error("Failed to finalize bottle alias.");
  }

  if (newAlias.bottleId && newAlias.bottleId !== bottle.id) {
    throw new BottleAlreadyExistsError(newAlias.bottleId);
  }

  newAliases.push(alias.name);

  const promises: Promise<any>[] = [
    tx.insert(changes).values({
      objectType: "bottle",
      objectId: bottle.id,
      createdAt: bottle.createdAt,
      createdById: user.id,
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
    newEntityIds: Array.from(newEntityIds),
    seriesCreated,
  };
}

export async function finalizeCreatedBottle(
  { bottle, seriesCreated, newAliases, newEntityIds }: CreateBottleResult,
  {
    creationSource = "manual_entry",
  }: {
    creationSource?: CatalogVerificationCreationSource;
  } = {},
) {
  try {
    await pushJob("OnBottleChange", { bottleId: bottle.id });
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
      await pushJob("IndexBottleSeriesSearchVectors", {
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
      await pushJob("OnBottleAliasChange", { name: aliasName });
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
      await pushJob("OnEntityChange", { entityId });
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
  const result = await db.transaction(async (tx) =>
    createBottleInTransaction(tx, {
      creationSource,
      input,
      context,
    }),
  );

  await finalizeCreatedBottle(result, { creationSource });

  return await serialize(BottleSerializer, result.bottle, context.user);
}
