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
    releaseId = null,
    aliasReleaseId = releaseId,
    externalSiteId,
    name,
    volume,
  }: {
    bottleId: number;
    releaseId?: number | null;
    aliasReleaseId?: number | null;
    externalSiteId?: number;
    name: string;
    volume?: number;
  },
): Promise<{ alias: BottleAlias; isNew: boolean }> {
  const existingAlias = await tx.query.bottleAliases.findFirst({
    where: eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()),
  });

  let alias: BottleAlias | undefined;
  let isNew = false;
  const nextAliasReleaseId =
    aliasReleaseId === null
      ? (existingAlias?.releaseId ?? null)
      : aliasReleaseId;

  const hasMatchingBottle = existingAlias?.bottleId === bottleId;
  const hasMatchingRelease =
    existingAlias?.releaseId === aliasReleaseId ||
    existingAlias?.releaseId === null ||
    aliasReleaseId === null;

  if (hasMatchingBottle && hasMatchingRelease) {
    if (
      existingAlias.name !== name ||
      (existingAlias.releaseId ?? null) !== nextAliasReleaseId
    ) {
      [alias] = await tx
        .update(bottleAliases)
        .set({
          name,
          releaseId: nextAliasReleaseId,
        })
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
        releaseId: aliasReleaseId,
      })
      .returning();
    isNew = true;
  } else if (!existingAlias.bottleId) {
    [alias] = await tx
      .update(bottleAliases)
      .set({
        bottleId,
        releaseId: aliasReleaseId,
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
      releaseId,
    })
    .where(
      sql`LOWER(${storePrices.name}) = ${name.toLowerCase()}
        ${externalSiteId ? sql`AND ${storePrices.externalSiteId} = ${externalSiteId}` : sql``}
        ${volume ? sql`AND ${storePrices.volume} = ${volume}` : sql``}`,
    )
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
    releaseId = null,
    aliasReleaseId = releaseId,
    externalSiteId,
    name,
    volume,
  }: {
    bottleId: number;
    releaseId?: number | null;
    aliasReleaseId?: number | null;
    externalSiteId?: number;
    name: string;
    volume?: number;
  },
  contexts?: Record<string, Record<string, any>>,
) {
  const result = await db.transaction(async (tx) =>
    assignBottleAliasInTransaction(tx, {
      bottleId,
      releaseId,
      aliasReleaseId,
      externalSiteId,
      name,
      volume,
    }),
  );

  await finalizeBottleAliasAssignment(result, contexts);

  return result;
}
