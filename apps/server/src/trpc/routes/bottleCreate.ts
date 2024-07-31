import { db } from "@peated/server/db";
import type { Bottle, Entity, NewBottle } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import { generateUniqHash } from "@peated/server/lib/bottleHash";
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

    const bottleInsertData: Omit<NewBottle, "uniqHash"> = {
      ...bottleData,
      brandId: brand.id,
      bottlerId: bottler?.id || null,
      createdById: user.id,
      fullName: `${brand.shortName || brand.name} ${bottleData.name}`,
    };

    const uniqHash = generateUniqHash(bottleInsertData);

    // bottles ae unique on aliases, so if an alias exists that is bound to
    // another bottle, that means this bottle already exists
    //
    // 1. look for an existing hash
    // 2. if it doesnt exist, or it doesnt have a bottleId, we can create this bottle
    // 3. finally persist the bottleId to the new hash
    //
    // in all of these scenarios we need to run constraint checks
    const aliasName = formatBottleName(bottleInsertData);
    const alias = await upsertBottleAlias(tx, aliasName);
    if (alias.bottleId) {
      const [existingBottle] = await tx
        .select()
        .from(bottles)
        .where(eq(bottles.id, alias.bottleId));
      throw new ConflictError(existingBottle);
    }

    const [bottle] = await tx
      .insert(bottles)
      .values({
        ...bottleInsertData,
        uniqHash,
      })
      .returning();

    const [newAlias] = await tx
      .update(bottleAliases)
      .set({
        bottleId: bottle.id,
      })
      .where(
        and(
          eq(sql`LOWER(${alias.name})`, alias.name.toLowerCase()),
          isNull(bottleAliases.bottleId),
        ),
      )
      .returning();

    // someone beat us to it?
    if (newAlias.bottleId !== bottle.id) {
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

  if (!bottle) {
    throw new TRPCError({
      message: "Failed to create bottle.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

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
