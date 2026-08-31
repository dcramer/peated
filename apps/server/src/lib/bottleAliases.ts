import {
  db,
  type AnyConnection,
  type AnyDatabase,
  type AnyTransaction,
} from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  bottles,
  type BottleAlias,
} from "@peated/server/db/schema";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import { and, asc, eq, inArray } from "drizzle-orm";

export class BottleAliasBottleNotFoundError extends Error {
  constructor() {
    super("Bottle not found.");
    this.name = "BottleAliasBottleNotFoundError";
  }
}

export class BottleAliasBottleInactiveError extends Error {
  constructor() {
    super("Other names can only be added to an active Bottle.");
    this.name = "BottleAliasBottleInactiveError";
  }
}

export class BottleAliasCanonicalNameError extends Error {
  constructor() {
    super("This is already the Bottle's primary name.");
    this.name = "BottleAliasCanonicalNameError";
  }
}

export class BottleAliasDuplicateError extends Error {
  constructor() {
    super("This Bottle already has that name.");
    this.name = "BottleAliasDuplicateError";
  }
}

export function normalizeBottleAliasName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function bottleAliasComparisonKey(name: string) {
  return normalizeBottleReferenceKey(name).toLocaleLowerCase("en-US");
}

export async function createBottleAlias(
  {
    bottleId,
    name,
    createdByActorId,
  }: { bottleId: number; name: string; createdByActorId: number },
  database: AnyConnection = db,
): Promise<BottleAlias> {
  const displayName = normalizeBottleAliasName(name);
  if (!displayName) throw new BottleAliasDuplicateError();
  const normalizedName = bottleAliasComparisonKey(displayName);

  return await database.transaction(async (tx) => {
    const [bottle] = await tx
      .select({
        id: bottles.id,
        fullName: bottles.fullName,
        groupId: bottles.groupId,
      })
      .from(bottles)
      .where(eq(bottles.id, bottleId))
      .for("update");
    if (!bottle) throw new BottleAliasBottleNotFoundError();

    const tombstone = await tx.query.bottleTombstones.findFirst({
      where: eq(bottleTombstones.bottleId, bottleId),
    });
    if (bottle.groupId === null || tombstone) {
      throw new BottleAliasBottleInactiveError();
    }
    if (bottleAliasComparisonKey(bottle.fullName) === normalizedName) {
      throw new BottleAliasCanonicalNameError();
    }

    const existing = await tx.query.bottleAliases.findFirst({
      where: and(
        eq(bottleAliases.bottleId, bottleId),
        eq(bottleAliases.normalizedName, normalizedName),
      ),
    });
    if (existing) throw new BottleAliasDuplicateError();

    const [alias] = await tx
      .insert(bottleAliases)
      .values({ bottleId, name: displayName, normalizedName, createdByActorId })
      .returning();
    if (!alias) throw new Error("Failed to add another Bottle name.");
    return alias;
  });
}

export async function deleteBottleAlias(
  { bottleId, aliasId }: { bottleId: number; aliasId: number },
  database: AnyDatabase = db,
) {
  const [alias] = await database
    .delete(bottleAliases)
    .where(
      and(eq(bottleAliases.id, aliasId), eq(bottleAliases.bottleId, bottleId)),
    )
    .returning();
  if (!alias) throw new BottleAliasBottleNotFoundError();
  return alias;
}

/** Moves display aliases only. Exact-reference ownership is handled separately. */
export async function moveBottleAliasesForMergeInTransaction(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
  destinationCanonicalName: string,
) {
  const aliases = await tx
    .select()
    .from(bottleAliases)
    .where(
      inArray(bottleAliases.bottleId, [sourceBottleId, destinationBottleId]),
    )
    .orderBy(asc(bottleAliases.id))
    .for("update");
  const destinationKeys = new Set(
    aliases
      .filter(({ bottleId }) => bottleId === destinationBottleId)
      .map(({ normalizedName }) => normalizedName),
  );
  destinationKeys.add(bottleAliasComparisonKey(destinationCanonicalName));

  for (const alias of aliases.filter(
    ({ bottleId }) => bottleId === sourceBottleId,
  )) {
    if (destinationKeys.has(alias.normalizedName)) {
      await tx.delete(bottleAliases).where(eq(bottleAliases.id, alias.id));
      continue;
    }
    await tx
      .update(bottleAliases)
      .set({ bottleId: destinationBottleId, updatedAt: new Date() })
      .where(eq(bottleAliases.id, alias.id));
    destinationKeys.add(alias.normalizedName);
  }
}
