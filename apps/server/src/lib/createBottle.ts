import { type CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle, Entity, NewBottle, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  changes,
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
