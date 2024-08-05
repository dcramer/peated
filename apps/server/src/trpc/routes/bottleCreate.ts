import type { AnyDatabase, AnyTransaction } from "@peated/server/db";
import { db as defaultDb } from "@peated/server/db";
import type {
  Bottle,
  BottleEdition,
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

async function createBottleAndEdition(
  {
    brand,
    bottler,
    distillers,
    ...data
  }: Omit<
    NewBottle &
      NewBottleEdition & {
        brand: Entity;
        bottler: Entity | null;
        distillers: Entity[];
      },
    "bottleId" | "brandId" | "bottlerId" | "fullName" | "createdById"
  >,
  userId: number,
  tx: AnyTransaction,
): Promise<[Bottle, BottleEdition]> {
  const bottleEditionData: Omit<NewBottleEdition, "bottleId"> = {
    ...data,
    createdById: userId,
    fullName: `${brand.shortName || brand.name} ${data.name}${data.editionName || ""}`,
  };

  const bottleRootData: NewBottle = {
    ...data,
    brandId: brand.id,
    bottlerId: bottler?.id || null,
    createdById: userId,
    fullName: `${brand.shortName || brand.name} ${data.name}`,
  };

  // bottles editions are unique on aliases

  // 1. find an existing alias matching this _full edition name_
  // 2. or find an existing alias matching this _bottle name_ without the edition
  // 3. or create a new bottle, as well as the edition, and the two related aliases
  const editionAliasName = formatBottleName({
    ...bottleRootData,
    ...bottleEditionData,
  });
  const rootAliasName = bottleEditionData.editionName
    ? formatBottleName(bottleRootData)
    : editionAliasName;

  // First, test to see if this edition already exists via aliases.
  const alias = await upsertBottleAlias(tx, editionAliasName);
  if (alias.editionId) {
    const [existingBottleEdition] = await tx
      .select()
      .from(bottleEditions)
      .where(eq(bottleEditions.id, alias.editionId));
    throw new ConflictError(existingBottleEdition);
  } else if (alias.bottleId) {
    throw new Error("Not Implemented");
  }

  // Edition appears new, lets see if we need to create the bottle
  // or if it exists due to another edition/alias.
  let bottleId;
  if (bottleEditionData.editionName) {
    const alias = await upsertBottleAlias(tx, rootAliasName);
    bottleId = alias.bottleId;
    // TODO: should we test that the edition has no suffix here?
  }

  let bottle;
  if (bottleId) {
    [bottle] = await tx.select().from(bottles).where(eq(bottles.id, bottleId));
  } else {
    [bottle] = await tx.transaction(async (sTx) => {
      return await createBottleAndEdition(
        {
          // this feels brittle
          name: data.name,
          category: data.category ?? null,
          statedAge: data.statedAge ?? null,
          caskStrength: data.caskStrength ?? null,
          singleCask: data.singleCask ?? null,
          brand,
          bottler,
          distillers,
        },
        userId,
        sTx,
      );
    });
  }

  if (bottleEditionData.editionName) {
    // persist root alias
    const [newAlias] = await tx
      .update(bottleAliases)
      .set({
        bottleId: bottle.id,
      })
      .where(
        and(
          eq(sql`LOWER(${bottleAliases.name})`, rootAliasName.toLowerCase()),
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
  }

  const [edition] = await tx
    .insert(bottleEditions)
    .values({
      bottleId: bottle.id,
      ...bottleEditionData,
    })
    .returning();

  // persist edition alias
  const [newAlias] = await tx
    .update(bottleAliases)
    .set({
      bottleId: bottle.id,
      editionId: edition.id,
    })
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, editionAliasName.toLowerCase()),
        isNull(bottleAliases.bottleId),
      ),
    )
    .returning();

  // someone beat us to it?
  if (
    (newAlias.bottleId && newAlias.bottleId !== bottle.id) ||
    (newAlias.editionId && newAlias.editionId !== edition.id)
  ) {
    if (newAlias.editionId) {
      const [existingBottleEdition] = await tx
        .select()
        .from(bottleEditions)
        .where(eq(bottleEditions.id, newAlias.editionId));
      throw new ConflictError(existingBottleEdition);
    } else {
      throw Error("Not Implemented");
    }
  }

  const distillerIds = distillers.map((d) => d.id);

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
    createdById: userId,
    displayName: bottle.fullName,
    type: "add",
    data: {
      ...bottle,
      distillerIds,
    },
  });

  await tx.insert(changes).values({
    objectType: "bottle_edition",
    objectId: edition.id,
    createdAt: edition.createdAt,
    createdById: userId,
    displayName: edition.fullName,
    type: "add",
    data: {
      ...edition,
    },
  });

  return [bottle, edition];
}

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

  const [bottle, edition]: [Bottle | undefined, BottleEdition | undefined] =
    await db.transaction(async (tx) => {
      // build our relations first
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

      // pass everything upwards, as we need to recurse and create the root
      // bottle in somme situations
      return await createBottleAndEdition(
        {
          ...bottleData,
          brand,
          bottler,
          distillers: distillerList,
        },
        user.id,
        tx,
      );
    });

  if (!bottle) {
    throw new TRPCError({
      message: "Unable to create bottle",
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
