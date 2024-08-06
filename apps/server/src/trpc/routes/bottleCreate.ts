import type { AnyTransaction } from "@peated/server/db";
import { db } from "@peated/server/db";
import type {
  Bottle,
  BottleAlias,
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
import {
  BottleEditionSerializer,
  BottleSerializer,
} from "@peated/server/serializers/bottle";
import type { BottlePreviewResult } from "@peated/server/types";
import { pushJob } from "@peated/server/worker/client";
import type { JobName } from "@peated/server/worker/types";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";
import { ConflictError } from "../errors";
import { bottleNormalize } from "./bottlePreview";

async function createEdition(
  {
    bottleId,
    brand,
    ...data
  }: Omit<
    NewBottle &
      NewBottleEdition & {
        brand: Entity;
      },
    "brandId" | "bottlerId" | "fullName" | "createdById"
  >,
  userId: number,
  tx: AnyTransaction,
): Promise<[BottleEdition, BottleAlias[]]> {
  const editionData: NewBottleEdition = {
    ...data,
    bottleId,
    createdById: userId,
    fullName: `${brand.shortName || brand.name} ${data.name}${data.editionName || ""}`,
  };
  const aliasName = formatBottleName(editionData);

  // First, test to see if this edition already exists via aliases.
  const alias = await upsertBottleAlias(tx, aliasName);
  if (alias.editionId) {
    const [existingBottleEdition] = await tx
      .select()
      .from(bottleEditions)
      .where(eq(bottleEditions.id, alias.editionId));
    throw new ConflictError(existingBottleEdition);
  } else if (alias.bottleId && alias.bottleId !== bottleId) {
    const [existingBottle] = await tx
      .select()
      .from(bottles)
      .where(eq(bottles.id, alias.bottleId));
    throw new ConflictError(existingBottle);
  }

  const [edition] = await tx
    .insert(bottleEditions)
    .values(editionData)
    .returning();

  // persist edition alias
  const [newAlias] = await tx
    .update(bottleAliases)
    .set({
      bottleId: bottleId,
      editionId: edition.id,
    })
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()),
        isNull(bottleAliases.bottleId),
        isNull(bottleAliases.editionId),
      ),
    )
    .returning();

  // someone beat us to it?
  if (!newAlias) {
    throw Error("This shouldnt happen");
  } else if (
    (newAlias.bottleId && newAlias.bottleId !== bottleId) ||
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

  return [edition, [newAlias]];
}

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
): Promise<{
  bottle: Bottle;
  edition: BottleEdition;
  rootEditionIfNew: BottleEdition | null;
  newAliasList: BottleAlias[];
}> {
  const bottleData: NewBottle = {
    name: data.name,
    category: data.category ?? null,
    statedAge: data.statedAge ?? null,
    caskStrength: data.caskStrength ?? null,
    singleCask: data.singleCask ?? null,
    brandId: brand.id,
    bottlerId: bottler?.id || null,
    createdById: userId,
    flavorProfile: data.flavorProfile ?? null,
    fullName: `${brand.shortName || brand.name} ${data.name}`,
  };

  let rootEditionIfNew: BottleEdition | null = null;
  let rootAliasList: BottleAlias[] = [];

  // First, attempt to identify the bottle
  const aliasName = formatBottleName(bottleData);
  const alias = await upsertBottleAlias(tx, aliasName);

  let bottleId = alias.bottleId;
  let bottle;
  // Bottle doesn't seem to exist, so we need to create it,
  // create it's edition (with no edition-specific details),
  // and then assign the alias.
  if (!bottleId) {
    [bottle] = await tx.insert(bottles).values(bottleData).returning();

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

    bottleId = bottle.id;

    [rootEditionIfNew, rootAliasList] = await createEdition(
      {
        bottleId,
        brand,
        ...(data.editionName ? bottleData : data),
      },
      userId,
      tx,
    );
  } else {
    [bottle] = await tx.select().from(bottles).where(eq(bottles.id, bottleId));
  }

  if (!bottleId) {
    throw new TRPCError({
      message: "Unhandled",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  // determine if we're actually trying to create a child edition or not
  // given we forced ourselves to create the parent if it didnt exist
  if (!data.editionName) {
    if (rootEditionIfNew) {
      return {
        bottle,
        rootEditionIfNew: null,
        edition: rootEditionIfNew,
        newAliasList: rootAliasList,
      };
    }

    // this means its a conflict or it would have created the rootEdition
    const [existingEdition] = await tx
      .select()
      .from(bottleEditions)
      .where(
        and(
          eq(bottleEditions.bottleId, bottleId),
          isNull(bottleEditions.editionName),
        ),
      );

    if (!existingEdition) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Missing core edition for bottle (this is a serious bug!)",
      });
    }

    throw new ConflictError(existingEdition);
  }

  const [edition, editionAliasList] = await createEdition(
    {
      bottleId,
      brand,
      ...data,
    },
    userId,
    tx,
  );

  return {
    bottle,
    edition,
    rootEditionIfNew,
    newAliasList: [...rootAliasList, ...editionAliasList],
  };
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

  const newEntityIds: Set<number> = new Set();

  const { bottle, edition, rootEditionIfNew, newAliasList } =
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

  const jobs: [JobName, any][] = [];
  if (rootEditionIfNew) {
    jobs.push(["OnBottleChange", { bottleId: bottle.id }]);
    jobs.push(["OnBottleEditionChange", { editionId: rootEditionIfNew.id }]);
  }
  jobs.push(["OnBottleEditionChange", { editionId: edition.id }]);
  for (const name of newAliasList) {
    jobs.push(["OnBottleAliasChange", { name }]);
  }
  for (const entityId of newEntityIds.values()) {
    jobs.push(["OnEntityChange", { entityId }]);
  }

  try {
    await Promise.all(
      jobs.map(([jobName, jobArgs]) => {
        return pushJob(jobName, jobArgs);
      }),
    );
  } catch (err) {
    logError(err, {
      bottle: {
        id: bottle.id,
      },
      edition: {
        id: edition.id,
      },
    });
  }

  return {
    bottle: await serialize(BottleSerializer, bottle, ctx.user),
    edition: await serialize(BottleEditionSerializer, edition, ctx.user),
  };
}

export default authedProcedure.input(BottleInputSchema).mutation(bottleCreate);
