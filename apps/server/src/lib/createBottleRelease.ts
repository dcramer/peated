import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle, BottleRelease, User } from "@peated/server/db/schema";
import { bottleReleases, bottles, changes } from "@peated/server/db/schema";
import { findExistingBottleReleaseByIdentity } from "@peated/server/lib/bottleReleaseIdentity";
import {
  formatCanonicalReleaseName,
  getCanonicalReleaseAliasNames,
  getResolvedReleaseIdentity,
  hasBottleLevelReleaseTraits,
} from "@peated/server/lib/bottleSchemaRules";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { logError } from "@peated/server/lib/log";
import type { BottleReleaseInputSchema } from "@peated/server/schemas";
import { pushJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";

export class BottleReleaseCreateBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleReleaseCreateBadRequestError";
  }
}

export class BottleReleaseAlreadyExistsError extends Error {
  constructor(readonly releaseId: number) {
    super("Bottle release already exists.");
    this.name = "BottleReleaseAlreadyExistsError";
  }
}

export type CreateBottleReleaseResult = {
  bottle: Bottle;
  release: BottleRelease;
  newAliases: string[];
};

export async function createBottleReleaseInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    input,
    user,
  }: {
    bottleId: number;
    input: z.infer<typeof BottleReleaseInputSchema>;
    user: User;
  },
): Promise<CreateBottleReleaseResult> {
  const [bottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1)
    .for("update");

  if (!bottle) {
    throw new BottleReleaseCreateBadRequestError("Bottle not found.");
  }

  if (hasBottleLevelReleaseTraits(bottle)) {
    throw new BottleReleaseCreateBadRequestError(
      "Bottle already stores specific release details on the parent record. A moderator must split or clear those bottle fields before adding child releases.",
    );
  }

  if (
    bottle.statedAge &&
    input.statedAge &&
    bottle.statedAge !== input.statedAge
  ) {
    throw new BottleReleaseCreateBadRequestError(
      "Release statedAge must match bottle's statedAge.",
    );
  }

  const resolvedReleaseIdentity = getResolvedReleaseIdentity({
    bottle,
    release: {
      edition: input.edition,
      statedAge: input.statedAge,
      abv: input.abv,
      releaseYear: input.releaseYear,
      vintageYear: input.vintageYear,
      singleCask: input.singleCask,
      caskStrength: input.caskStrength,
      caskSize: input.caskSize,
      caskType: input.caskType,
      caskFill: input.caskFill,
    },
  });

  const { name, fullName } = formatCanonicalReleaseName({
    bottleName: bottle.name,
    bottleFullName: bottle.fullName,
    bottleStatedAge: bottle.statedAge,
    release: resolvedReleaseIdentity,
  });

  const existingRelease = await findExistingBottleReleaseByIdentity(tx, {
    bottleId,
    release: resolvedReleaseIdentity,
  });

  if (existingRelease) {
    throw new BottleReleaseAlreadyExistsError(existingRelease.id);
  }

  if (name === bottle.name || fullName === bottle.fullName) {
    throw new BottleReleaseCreateBadRequestError(
      "Release name cannot be the same as the bottle name.",
    );
  }

  const [release] = await tx
    .insert(bottleReleases)
    .values({
      bottleId,
      fullName,
      name,
      edition: resolvedReleaseIdentity.edition,
      vintageYear: resolvedReleaseIdentity.vintageYear,
      releaseYear: resolvedReleaseIdentity.releaseYear,
      abv: resolvedReleaseIdentity.abv,
      singleCask: resolvedReleaseIdentity.singleCask,
      caskStrength: resolvedReleaseIdentity.caskStrength,
      statedAge: resolvedReleaseIdentity.statedAge,
      caskSize: resolvedReleaseIdentity.caskSize,
      caskType: resolvedReleaseIdentity.caskType,
      caskFill: resolvedReleaseIdentity.caskFill,
      description: input.description,
      imageUrl: input.imageUrl,
      tastingNotes: input.tastingNotes,
      createdById: user.id,
    })
    .returning();

  const newAliases: string[] = [];
  for (const aliasName of getCanonicalReleaseAliasNames({ fullName })) {
    const alias = await upsertBottleAlias(tx, aliasName, bottleId, release.id);
    if (
      alias.bottleId !== bottleId ||
      (alias.releaseId ?? null) !== release.id
    ) {
      throw new BottleReleaseCreateBadRequestError(
        "Release alias already belongs to a different bottle.",
      );
    }
    if (alias.bottleId === bottleId && alias.releaseId === release.id) {
      newAliases.push(aliasName);
    }
  }

  await Promise.all([
    tx.insert(changes).values({
      objectType: "bottle_release",
      objectId: release.id,
      createdById: user.id,
      createdAt: release.createdAt,
      displayName: release.fullName,
      type: "add",
      data: {
        ...release,
      },
    }),
    tx
      .update(bottles)
      .set({
        numReleases: sql`${bottles.numReleases} + 1`,
      })
      .where(eq(bottles.id, bottleId)),
  ]);

  return {
    bottle,
    release,
    newAliases,
  };
}

export async function finalizeCreatedBottleRelease({
  release,
  newAliases,
}: CreateBottleReleaseResult) {
  for (const aliasName of newAliases) {
    try {
      await pushJob("OnBottleAliasChange", { name: aliasName });
    } catch (err) {
      logError(err, {
        release: {
          id: release.id,
        },
        alias: {
          name: aliasName,
        },
      });
    }
  }

  try {
    await pushJob("OnBottleReleaseChange", { releaseId: release.id });
  } catch (err) {
    logError(err, {
      release: {
        id: release.id,
      },
    });
  }
}

export async function createBottleRelease({
  bottleId,
  input,
  user,
}: {
  bottleId: number;
  input: z.infer<typeof BottleReleaseInputSchema>;
  user: User;
}) {
  const result = await db.transaction(async (tx) =>
    createBottleReleaseInTransaction(tx, {
      bottleId,
      input,
      user,
    }),
  );

  await finalizeCreatedBottleRelease(result);

  return result.release;
}
