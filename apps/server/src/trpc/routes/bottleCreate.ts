import { db } from "@peated/server/db";
import type { Bottle, Entity } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs/client";
import { upsertEntity } from "@peated/server/lib/db";
import { notEmpty } from "@peated/server/lib/filter";
import { logError } from "@peated/server/lib/log";
import { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { BottlePreviewResult } from "@peated/server/types";
import { TRPCError } from "@trpc/server";
import { isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";
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

  const bottle: Bottle | undefined = await db.transaction(async (tx) => {
    const brandUpsert = await upsertEntity({
      db: tx,
      data: bottleData.brand,
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

    if (!bottleData.name) {
      throw new TRPCError({
        message: "Invalid bottle name.",
        code: "BAD_REQUEST",
      });
    }

    let bottler: Entity | null = null;
    if (bottleData.bottler) {
      const bottlerUpsert = await upsertEntity({
        db: tx,
        data: bottleData.bottler,
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

    const fullName = `${brand.shortName || brand.name} ${bottleData.name}`;

    let bottle: Bottle | undefined;
    try {
      [bottle] = await tx
        .insert(bottles)
        .values({
          ...bottleData,
          fullName,
          brandId: brand.id,
          bottlerId: bottler?.id || null,
          createdById: user.id,
        })
        .returning();
    } catch (err: any) {
      if (
        err?.code === "23505" &&
        (err?.constraint === "bottle_brand_unq" ||
          err?.constraint === "bottle_name_unq")
      ) {
        throw new TRPCError({
          message: "Bottle with name already exists under brand.",
          code: "CONFLICT",
          cause: err,
        });
      }
      throw err;
    }
    if (!bottle) {
      return;
    }

    await tx
      .insert(bottleAliases)
      .values({
        bottleId: bottle.id,
        name: fullName,
      })
      .onConflictDoUpdate({
        target: [bottleAliases.name],
        set: {
          bottleId: bottle.id,
        },
        where: isNull(bottleAliases.bottleId),
      });

    const distillerIds: number[] = [];
    if (bottleData.distillers)
      for (const distData of bottleData.distillers) {
        const distUpsert = await upsertEntity({
          db: tx,
          data: distData,
          userId: user.id,
          type: "distiller",
        });
        if (!distUpsert) {
          throw new TRPCError({
            message: "Could not identify distiller.",
            code: "BAD_REQUEST",
          });
        }
        await tx.insert(bottlesToDistillers).values({
          bottleId: bottle.id,
          distillerId: distUpsert.id,
        });

        distillerIds.push(distUpsert.id);
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

    const allEntityIds = [
      ...distillerIds,
      bottle.brandId,
      bottle.bottlerId,
    ].filter(notEmpty);

    // XXX: this could be more optimal, but accounting is a pita
    await tx.update(entities).set({
      totalBottles: sql<number>`(
        SELECT COUNT(*)
        FROM ${bottles}
        WHERE (
          ${bottles.brandId} = ${entities.id}
          OR ${bottles.bottlerId} = ${entities.id}
          OR EXISTS(
            SELECT FROM ${bottlesToDistillers}
            WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
            AND ${bottlesToDistillers.distillerId} = ${entities.id}
          )
        )
        AND ${entities.id} IN ${allEntityIds}
      )`,
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
    await pushJob("GenerateBottleDetails", { bottleId: bottle.id });
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
