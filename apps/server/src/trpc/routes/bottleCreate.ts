import { db } from "@peated/server/db";
import type {
  Bottle,
  Entity,
  NewBottle,
  NewBottleEdition,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleEditions,
  bottles,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import {
  coerceToUpsert,
  upsertBottleAlias,
  upsertEntity,
} from "@peated/server/lib/db";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { BottlePreviewResult } from "@peated/server/types";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";
import { ConflictError } from "../errors";
import { bottleNormalize } from "./bottlePreview";

/**
 * Creating a bottle is a somewhat complex process, as it also manages the specific editions of
 * the bottle.
 *
 * That is, effectively this endpoint is "bottleEditionCreate", but it implicitly creates that
 * entry and keeps the root bottle in sync as needed.
 */
export async function bottleCreate({
  input,
  ctx,
}: {
  input: z.infer<typeof BottleInputSchema>;
  ctx: Context;
}) {
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({
      message: "Unauthorzed!",
      code: "UNAUTHORIZED",
    });
  }

  const bottleData: BottlePreviewResult & Record<string, any> =
    await bottleNormalize({ input, ctx });

  if (input.description !== undefined) {
    bottleData.description = input.description;
    bottleData.descriptionSrc =
      input.descriptionSrc ||
      (input.description && input.description !== null ? "user" : null);
  }

  if (!bottleData.name) {
    throw new TRPCError({
      message: "Invalid bottle name.",
      code: "BAD_REQUEST",
    });
  }

  const newAliases: string[] = [];
  const newEntityIds: Set<number> = new Set();

  const bottle: Bottle | undefined = await db.transaction(async (tx) => {
    const brandUpsert = await upsertEntity({
      db: tx,
      data: coerceToUpsert(bottleData.brand),
      type: "brand",
      userId: user.id,
    });

    if (!brandUpsert) {
      throw new TRPCError({
        message: "Could not identify brand.",
        code: "BAD_REQUEST",
      });
    }
    if (brandUpsert.created) newEntityIds.add(brandUpsert.id);

    const brand = brandUpsert.result;

    let bottler: Entity | null = null;
    if (bottleData.bottler) {
      const bottlerUpsert = await upsertEntity({
        db: tx,
        data: coerceToUpsert(bottleData.bottler),
        type: "bottler",
        userId: user.id,
      });
      if (!bottlerUpsert) {
        throw new TRPCError({
          message: "Could not identify bottler.",
          code: "BAD_REQUEST",
        });
      }
      if (bottlerUpsert.created) newEntityIds.add(bottlerUpsert.id);
      bottler = bottlerUpsert.result;
    }

    const distillerIds: number[] = [];
    const distillerList: Entity[] = [];
    if (bottleData.distillers)
      for (const distData of bottleData.distillers) {
        const distUpsert = await upsertEntity({
          db: tx,
          data: coerceToUpsert(distData),
          userId: user.id,
          type: "distiller",
        });
        if (!distUpsert) {
          throw new TRPCError({
            message: "Could not identify distiller.",
            code: "BAD_REQUEST",
          });
        }
        if (distUpsert.created) newEntityIds.add(distUpsert.id);
        distillerList.push(distUpsert.result);
        distillerIds.push(distUpsert.id);
      }

    const bottleEditionData: Omit<NewBottleEdition, "bottleId"> = {
      ...bottleData,
      createdById: user.id,
      fullName: `${brand.shortName || brand.name} ${bottleData.name}${bottleData.editionName || ""}`,
    };

    const bottleInsertData: NewBottle = {
      ...bottleData,
      brandId: brand.id,
      bottlerId: bottler?.id || null,
      createdById: user.id,
      fullName: `${brand.shortName || brand.name} ${bottleData.name}`,
    };

    // bottles editions are unique on aliases

    // 1. find an existing alias matching this _full edition name_
    // 2. or find an existing alias matching this _bottle name_ without the edition
    // 3. or create a new bottle, as well as the edition, and the two related aliases
    const aliasName = formatBottleName(bottleInsertData);
    const alias = await upsertBottleAlias(tx, aliasName);
    if (alias.editionId) {
      const [existingBottlEdition] = await tx
        .select()
        .from(bottleEditions)
        .where(eq(bottleEditions.id, alias.editionId));
      throw new ConflictError(existingBottlEdition);
    } else if (alias.bottleId) {
      throw new Error("Not Implemented");
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

    // someone beat us to it?
    if (newAlias.bottleId && newAlias.bottleId !== bottle.id) {
      const [existingBottle] = await tx
        .select()
        .from(bottles)
        .where(eq(bottles.id, newAlias.bottleId));
      throw new ConflictError(existingBottle);
    }

    for (const distillerId of distillerIds) {
      await tx.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId,
      });
    }

    await tx.insert(changes).values({
      objectType: "bottle",
      objectId: bottle.id,
      createdAt: bottle.createdAt,
      createdById: user.id,
      displayName: bottle.fullName,
      type: "add",
      data: {
        ...bottle,
        distillerIds,
      },
    });

    return bottle;
  });

  try {
    await pushJob("OnBottleChange", { bottleId: bottle.id });
  } catch (err) {
    logError(err, {
      bottle: {
        id: bottle.id,
      },
    });
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

  for (const entityId of newEntityIds.values()) {
    try {
      await pushJob("OnEntityChange", { entityId });
    } catch (err) {
      logError(err, {
        entity: {
          id: entityId,
        },
      });
    }
  }

  return await serialize(BottleSerializer, bottle, ctx.user);
}

export default authedProcedure.input(BottleInputSchema).mutation(bottleCreate);
