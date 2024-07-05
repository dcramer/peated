import { db } from "@peated/server/db";
import type { Bottle, Entity, NewBottle } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import { generateUniqHash } from "@peated/server/lib/bottleHash";
import { upsertEntity } from "@peated/server/lib/db";
import { logError } from "@peated/server/lib/log";
import { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type {
  BottlePreviewResult,
  EntityInput,
  FreeformEntity,
} from "@peated/server/types";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";
import { ConflictError } from "../errors";
import { bottleNormalize } from "./bottlePreview";

function coerceToUpsert(data: FreeformEntity): EntityInput {
  if (data.country instanceof Object) {
    return {
      ...data,
      country: data.country.name,
    };
  }
  return data as EntityInput;
}

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

    const brand = brandUpsert.result;

    let bottler: Entity | null = null;
    if (bottleData.bottler) {
      const bottlerUpsert = await upsertEntity({
        db: tx,
        data: coerceToUpsert(bottleData.bottler),
        type: "bottler",
        userId: user.id,
      });
      if (bottlerUpsert) {
        bottler = bottlerUpsert.result;
      } else {
        throw new TRPCError({
          message: "Could not identify bottler.",
          code: "BAD_REQUEST",
        });
      }
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

    let bottle: Bottle | undefined;
    try {
      [bottle] = await tx
        .insert(bottles)
        .values({
          ...bottleInsertData,
          uniqHash,
        })
        .returning();
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "bottle_uniq_hash") {
        const [existingBottle] = await db
          .select()
          .from(bottles)
          .where(eq(bottles.uniqHash, uniqHash));
        throw new ConflictError(existingBottle, err);
      }
      throw err;
    }
    if (!bottle) {
      return;
    }

    const aliasName = bottle.vintageYear
      ? `${bottle.fullName} (${bottle.vintageYear})`
      : bottle.fullName;

    await tx
      .insert(bottleAliases)
      .values({
        bottleId: bottle.id,
        name: aliasName,
      })
      .onConflictDoUpdate({
        target: [bottleAliases.name],
        set: {
          bottleId: bottle.id,
        },
        where: isNull(bottleAliases.bottleId),
      });

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

  return await serialize(BottleSerializer, bottle, ctx.user);
}

export default authedProcedure.input(BottleInputSchema).mutation(bottleCreate);
