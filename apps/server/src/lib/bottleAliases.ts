import { db, type AnyDatabase } from "@peated/server/db";
import type { BottleAlias } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";

export class DuplicateBottleAliasError extends Error {
  constructor(readonly bottleId: number) {
    super(`Duplicate alias found (${bottleId}). Not implemented.`);
    this.name = "DuplicateBottleAliasError";
  }
}

export class FailedToSaveBottleAliasError extends Error {
  constructor() {
    super("Failed to save alias.");
    this.name = "FailedToSaveBottleAliasError";
  }
}

export async function assignBottleAliasInTransaction(
  tx: AnyDatabase,
  {
    bottleId,
    name,
  }: {
    bottleId: number;
    name: string;
  },
): Promise<{ alias: BottleAlias; isNew: boolean }> {
  const existingAlias = await tx.query.bottleAliases.findFirst({
    where: eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()),
  });

  let alias: BottleAlias | undefined;
  let isNew = false;

  if (existingAlias?.bottleId === bottleId) {
    if (existingAlias.name !== name) {
      [alias] = await tx
        .update(bottleAliases)
        .set({ name })
        .where(eq(bottleAliases.name, existingAlias.name))
        .returning();
    } else {
      alias = existingAlias;
    }
  } else if (!existingAlias) {
    [alias] = await tx
      .insert(bottleAliases)
      .values({
        name,
        bottleId,
      })
      .returning();
    isNew = true;
  } else if (!existingAlias.bottleId) {
    [alias] = await tx
      .update(bottleAliases)
      .set({
        bottleId,
      })
      .where(eq(bottleAliases.name, existingAlias.name))
      .returning();
  } else {
    throw new DuplicateBottleAliasError(existingAlias.bottleId);
  }

  if (!alias) {
    throw new FailedToSaveBottleAliasError();
  }

  const matchingPrices = await tx
    .update(storePrices)
    .set({
      bottleId,
    })
    .where(eq(sql`LOWER(${storePrices.name})`, name.toLowerCase()))
    .returning({
      imageUrl: storePrices.imageUrl,
    });

  const priceWithImage = matchingPrices.find((price) => !!price.imageUrl);
  if (priceWithImage?.imageUrl) {
    const [bottle] = await tx
      .select({
        imageUrl: bottles.imageUrl,
      })
      .from(bottles)
      .where(eq(bottles.id, bottleId));

    if (bottle && !bottle.imageUrl) {
      await tx
        .update(bottles)
        .set({
          imageUrl: priceWithImage.imageUrl,
        })
        .where(eq(bottles.id, bottleId));
    }
  }

  await tx
    .update(reviews)
    .set({
      bottleId,
    })
    .where(eq(sql`LOWER(${reviews.name})`, name.toLowerCase()));

  return {
    alias,
    isNew,
  };
}

export async function finalizeBottleAliasAssignment(
  {
    alias,
    isNew,
  }: {
    alias: BottleAlias;
    isNew: boolean;
  },
  contexts?: Record<string, Record<string, any>>,
) {
  if (isNew) {
    try {
      await pushJob("OnBottleAliasChange", { name: alias.name });
    } catch (err) {
      logError(err, contexts);
    }
  }

  if (alias.bottleId) {
    try {
      await pushUniqueJob("IndexBottleSearchVectors", {
        bottleId: alias.bottleId,
      });
    } catch (err) {
      logError(err, contexts);
    }
  }
}

export async function assignBottleAlias(
  {
    bottleId,
    name,
  }: {
    bottleId: number;
    name: string;
  },
  contexts?: Record<string, Record<string, any>>,
) {
  const result = await db.transaction(async (tx) =>
    assignBottleAliasInTransaction(tx, {
      bottleId,
      name,
    }),
  );

  await finalizeBottleAliasAssignment(result, contexts);

  return result;
}
