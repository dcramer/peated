import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle, BottleRelease, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleObservations,
  bottleReleases,
  bottles,
  changes,
  collectionBottles,
  entities,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { hasBottleLevelReleaseTraits } from "@peated/server/lib/bottleSchemaRules";
import {
  BottleReleaseAlreadyExistsError,
  BottleReleaseCreateBadRequestError,
  createBottleReleaseInTransaction,
} from "@peated/server/lib/createBottleRelease";
import { upsertBottleAlias } from "@peated/server/lib/db";
import {
  deriveLegacyReleaseRepairIdentity,
  resolveLegacyReleaseRepairNameScope,
} from "@peated/server/lib/legacyReleaseRepairCandidates";
import { logError } from "@peated/server/lib/log";
import {
  normalizeString,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/server/lib/normalize";
import { pushJob } from "@peated/server/worker/client";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

type RepairBottle = Pick<
  Bottle,
  | "abv"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "description"
  | "descriptionSrc"
  | "edition"
  | "fullName"
  | "brandId"
  | "id"
  | "imageUrl"
  | "name"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "tastingNotes"
  | "vintageYear"
>;

type RepairRelease = Pick<
  BottleRelease,
  | "abv"
  | "bottleId"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "description"
  | "edition"
  | "fullName"
  | "id"
  | "imageUrl"
  | "name"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "tastingNotes"
  | "totalTastings"
  | "vintageYear"
>;

type ApplyDirtyParentReleaseRepairResult = {
  aliasNames: string[];
  bottleId: number;
  releaseId: number;
};

export class DirtyParentReleaseRepairBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirtyParentReleaseRepairBadRequestError";
  }
}

async function getBottleForRepair(tx: AnyTransaction, bottleId: number) {
  const [bottle] = await tx
    .select({
      id: bottles.id,
      fullName: bottles.fullName,
      name: bottles.name,
      brandId: bottles.brandId,
      statedAge: bottles.statedAge,
      description: bottles.description,
      descriptionSrc: bottles.descriptionSrc,
      imageUrl: bottles.imageUrl,
      tastingNotes: bottles.tastingNotes,
      edition: bottles.edition,
      releaseYear: bottles.releaseYear,
      vintageYear: bottles.vintageYear,
      abv: bottles.abv,
      singleCask: bottles.singleCask,
      caskStrength: bottles.caskStrength,
      caskFill: bottles.caskFill,
      caskType: bottles.caskType,
      caskSize: bottles.caskSize,
    })
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1)
    .for("update");

  if (!bottle) {
    throw new DirtyParentReleaseRepairBadRequestError("Bottle not found.");
  }

  if (!hasBottleLevelReleaseTraits(bottle)) {
    throw new DirtyParentReleaseRepairBadRequestError(
      "Bottle does not contain bottle-level release traits to repair.",
    );
  }

  return bottle satisfies RepairBottle;
}

async function getLockedReleasesForRepair(
  tx: AnyTransaction,
  bottleId: number,
): Promise<RepairRelease[]> {
  return tx
    .select({
      id: bottleReleases.id,
      bottleId: bottleReleases.bottleId,
      fullName: bottleReleases.fullName,
      name: bottleReleases.name,
      statedAge: bottleReleases.statedAge,
      edition: bottleReleases.edition,
      releaseYear: bottleReleases.releaseYear,
      vintageYear: bottleReleases.vintageYear,
      abv: bottleReleases.abv,
      singleCask: bottleReleases.singleCask,
      caskStrength: bottleReleases.caskStrength,
      caskFill: bottleReleases.caskFill,
      caskType: bottleReleases.caskType,
      caskSize: bottleReleases.caskSize,
      totalTastings: bottleReleases.totalTastings,
      description: bottleReleases.description,
      imageUrl: bottleReleases.imageUrl,
      tastingNotes: bottleReleases.tastingNotes,
    })
    .from(bottleReleases)
    .where(eq(bottleReleases.bottleId, bottleId))
    .orderBy(
      sql`${bottleReleases.totalTastings} DESC NULLS LAST`,
      desc(bottleReleases.id),
    )
    .for("update");
}

async function backfillExistingReleaseMetadata(
  tx: AnyTransaction,
  {
    bottle,
    release,
  }: {
    bottle: RepairBottle;
    release: RepairRelease;
  },
) {
  const nextDescription = release.description ?? bottle.description ?? null;
  const nextImageUrl = release.imageUrl ?? bottle.imageUrl ?? null;
  const nextTastingNotes = release.tastingNotes ?? bottle.tastingNotes ?? null;

  if (
    nextDescription === release.description &&
    nextImageUrl === release.imageUrl &&
    nextTastingNotes === release.tastingNotes
  ) {
    return release;
  }

  const [updatedRelease] = await tx
    .update(bottleReleases)
    .set({
      description: nextDescription,
      imageUrl: nextImageUrl,
      tastingNotes: nextTastingNotes,
      updatedAt: sql`NOW()`,
    })
    .where(eq(bottleReleases.id, release.id))
    .returning();

  if (!updatedRelease) {
    throw new DirtyParentReleaseRepairBadRequestError(
      "Bottle release not found.",
    );
  }

  return updatedRelease satisfies RepairRelease;
}

async function getRepairedParentBottleNames(
  tx: AnyTransaction,
  bottle: RepairBottle,
): Promise<{
  fullName: string;
  name: string;
}> {
  const derivedIdentity = deriveLegacyReleaseRepairIdentity({
    fullName: bottle.fullName,
    edition: bottle.edition,
    releaseYear: bottle.releaseYear,
  });

  if (!derivedIdentity) {
    return {
      fullName: bottle.fullName,
      name: bottle.name,
    };
  }

  const [brand] = await tx
    .select({
      name: entities.name,
      shortName: entities.shortName,
    })
    .from(entities)
    .where(eq(entities.id, bottle.brandId))
    .limit(1);

  let nextName = derivedIdentity.proposedParentFullName;
  const brandNames = [
    ...new Set(
      [brand?.shortName, brand?.name].filter((value): value is string =>
        Boolean(value),
      ),
    ),
  ].sort((left, right) => right.length - left.length);

  for (const brandName of brandNames) {
    const strippedName = stripDuplicateBrandPrefixFromBottleName(
      nextName,
      brandName,
    );

    if (strippedName !== nextName) {
      nextName = strippedName;
      break;
    }
  }

  return {
    fullName: derivedIdentity.proposedParentFullName,
    name: nextName,
  };
}

function findExactReleaseNameMatch({
  name,
  releases,
}: {
  name: string;
  releases: Array<Pick<RepairRelease, "fullName" | "id" | "name">>;
}): null | number {
  const normalizedName = normalizeString(name).trim().toLowerCase();
  const exactRelease = releases.find(
    (release) =>
      normalizedName === release.fullName.toLowerCase() ||
      normalizedName === release.name.toLowerCase(),
  );

  return exactRelease?.id ?? null;
}

function resolveAliasReleaseId({
  bottleFullName,
  name,
  releases,
  targetReleaseId,
  targetReleaseIdentity,
}: {
  bottleFullName: string;
  name: string;
  releases: Array<Pick<RepairRelease, "fullName" | "id" | "name">>;
  targetReleaseId: number;
  targetReleaseIdentity: {
    edition: string | null;
    releaseYear: number | null;
  };
}): null | number {
  const exactReleaseId = findExactReleaseNameMatch({
    name,
    releases,
  });
  if (exactReleaseId !== null) {
    return exactReleaseId;
  }

  return resolveLegacyReleaseRepairNameScope({
    name,
    proposedParentFullName: bottleFullName,
    releaseIdentity: targetReleaseIdentity,
  }) === "release"
    ? targetReleaseId
    : null;
}

function resolveLinkedRowReleaseId({
  bottleFullName,
  name,
  releases,
  targetReleaseId,
  targetReleaseIdentity,
}: {
  bottleFullName: string;
  name: string;
  releases: Array<Pick<RepairRelease, "fullName" | "id" | "name">>;
  targetReleaseId: number;
  targetReleaseIdentity: {
    edition: string | null;
    releaseYear: number | null;
  };
}): null | number {
  const exactReleaseId = findExactReleaseNameMatch({
    name,
    releases,
  });
  if (exactReleaseId !== null) {
    return exactReleaseId;
  }

  return resolveLegacyReleaseRepairNameScope({
    name,
    proposedParentFullName: bottleFullName,
    releaseIdentity: targetReleaseIdentity,
  }) === "release"
    ? targetReleaseId
    : null;
}

export async function applyDirtyParentReleaseRepairInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    user,
  }: {
    bottleId: number;
    user: User;
  },
): Promise<ApplyDirtyParentReleaseRepairResult> {
  const bottle = await getBottleForRepair(tx, bottleId);
  const lockedReleases = await getLockedReleasesForRepair(tx, bottle.id);
  const bottleScopedAliases = await tx.query.bottleAliases.findMany({
    where: and(
      eq(bottleAliases.bottleId, bottle.id),
      isNull(bottleAliases.releaseId),
    ),
  });
  const bottleScopedReviews = await tx
    .select({ id: reviews.id, name: reviews.name })
    .from(reviews)
    .where(and(eq(reviews.bottleId, bottle.id), isNull(reviews.releaseId)));
  const bottleScopedStorePrices = await tx
    .select({ id: storePrices.id, name: storePrices.name })
    .from(storePrices)
    .where(
      and(eq(storePrices.bottleId, bottle.id), isNull(storePrices.releaseId)),
    );
  const bottleScopedCollectionRows = await tx
    .select({
      collectionId: collectionBottles.collectionId,
      createdAt: collectionBottles.createdAt,
    })
    .from(collectionBottles)
    .where(
      and(
        eq(collectionBottles.bottleId, bottle.id),
        isNull(collectionBottles.releaseId),
      ),
    );
  const bottleScopedFlightRows = await tx
    .select({
      flightId: flightBottles.flightId,
    })
    .from(flightBottles)
    .where(
      and(
        eq(flightBottles.bottleId, bottle.id),
        isNull(flightBottles.releaseId),
      ),
    );
  const repairedParentBottleNames = await getRepairedParentBottleNames(
    tx,
    bottle,
  );

  const clearedBottleRows = await tx
    .update(bottles)
    .set({
      fullName: repairedParentBottleNames.fullName,
      name: repairedParentBottleNames.name,
      edition: null,
      releaseYear: null,
      vintageYear: null,
      abv: null,
      singleCask: null,
      caskStrength: null,
      caskFill: null,
      caskType: null,
      caskSize: null,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      tastingNotes: null,
      updatedAt: sql`NOW()`,
    })
    .where(eq(bottles.id, bottle.id))
    .returning();

  if (!clearedBottleRows[0]) {
    throw new DirtyParentReleaseRepairBadRequestError("Bottle not found.");
  }
  const repairedBottle = clearedBottleRows[0];

  const aliasNames = new Set<string>();
  let release: RepairRelease | BottleRelease;

  try {
    const result = await createBottleReleaseInTransaction(tx, {
      bottleId: bottle.id,
      input: {
        edition: bottle.edition,
        statedAge: bottle.statedAge,
        abv: bottle.abv,
        releaseYear: bottle.releaseYear,
        vintageYear: bottle.vintageYear,
        singleCask: bottle.singleCask,
        caskStrength: bottle.caskStrength,
        caskFill: bottle.caskFill,
        caskType: bottle.caskType,
        caskSize: bottle.caskSize,
        description: bottle.description,
        imageUrl: bottle.imageUrl,
        tastingNotes: bottle.tastingNotes,
      },
      user,
    });
    release = result.release;
    for (const aliasName of result.newAliases) {
      aliasNames.add(aliasName);
    }
  } catch (err) {
    if (err instanceof BottleReleaseAlreadyExistsError) {
      const [existingRelease] = await tx
        .select()
        .from(bottleReleases)
        .where(eq(bottleReleases.id, err.releaseId))
        .limit(1)
        .for("update");

      if (!existingRelease) {
        throw new DirtyParentReleaseRepairBadRequestError(
          "Bottle release not found.",
        );
      }

      release = await backfillExistingReleaseMetadata(tx, {
        bottle,
        release: existingRelease,
      });
    } else if (err instanceof BottleReleaseCreateBadRequestError) {
      throw new DirtyParentReleaseRepairBadRequestError(err.message);
    } else {
      throw err;
    }
  }

  const repairedParentAlias = await upsertBottleAlias(
    tx,
    repairedBottle.fullName,
    repairedBottle.id,
  );
  if (
    repairedParentAlias.bottleId &&
    repairedParentAlias.bottleId !== repairedBottle.id
  ) {
    throw new DirtyParentReleaseRepairBadRequestError(
      "Bottle alias already belongs to a different bottle.",
    );
  }
  aliasNames.add(repairedBottle.fullName);

  const releasesForScope = [
    ...lockedReleases.filter((row) => row.id !== release.id),
    release,
  ];
  const targetReleaseIdentity = {
    edition: release.edition,
    releaseYear: release.releaseYear,
  };

  for (const alias of bottleScopedAliases) {
    const releaseId = resolveAliasReleaseId({
      bottleFullName: repairedBottle.fullName,
      name: alias.name,
      releases: releasesForScope,
      targetReleaseId: release.id,
      targetReleaseIdentity,
    });

    if (releaseId === null) {
      continue;
    }

    await tx
      .update(bottleAliases)
      .set({
        releaseId,
      })
      .where(
        and(
          eq(sql`LOWER(${bottleAliases.name})`, alias.name.toLowerCase()),
          eq(bottleAliases.bottleId, bottle.id),
          isNull(bottleAliases.releaseId),
        ),
      );

    aliasNames.add(alias.name);
  }

  for (const review of bottleScopedReviews) {
    await tx
      .update(reviews)
      .set({
        releaseId: resolveLinkedRowReleaseId({
          bottleFullName: repairedBottle.fullName,
          name: review.name,
          releases: releasesForScope,
          targetReleaseId: release.id,
          targetReleaseIdentity,
        }),
      })
      .where(eq(reviews.id, review.id));
  }

  for (const storePrice of bottleScopedStorePrices) {
    const releaseId = resolveLinkedRowReleaseId({
      bottleFullName: repairedBottle.fullName,
      name: storePrice.name,
      releases: releasesForScope,
      targetReleaseId: release.id,
      targetReleaseIdentity,
    });

    await tx
      .update(storePrices)
      .set({
        releaseId,
      })
      .where(eq(storePrices.id, storePrice.id));

    await tx
      .update(storePriceMatchProposals)
      .set({
        currentBottleId: bottle.id,
        currentReleaseId: releaseId,
        suggestedReleaseId: sql`CASE
          WHEN ${storePriceMatchProposals.suggestedBottleId} = ${bottle.id}
            AND ${storePriceMatchProposals.suggestedReleaseId} IS NULL
          THEN ${releaseId}
          ELSE ${storePriceMatchProposals.suggestedReleaseId}
        END`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(storePriceMatchProposals.priceId, storePrice.id));
  }

  await Promise.all([
    tx
      .update(tastings)
      .set({
        releaseId: release.id,
      })
      .where(and(eq(tastings.bottleId, bottle.id), isNull(tastings.releaseId))),
    tx
      .update(bottleObservations)
      .set({
        releaseId: release.id,
      })
      .where(
        and(
          eq(bottleObservations.bottleId, bottle.id),
          isNull(bottleObservations.releaseId),
        ),
      ),
  ]);

  if (bottleScopedCollectionRows.length > 0) {
    await tx
      .insert(collectionBottles)
      .values(
        bottleScopedCollectionRows.map((row) => ({
          collectionId: row.collectionId,
          bottleId: bottle.id,
          releaseId: release.id,
          createdAt: row.createdAt,
        })),
      )
      .onConflictDoNothing();

    await tx
      .delete(collectionBottles)
      .where(
        and(
          eq(collectionBottles.bottleId, bottle.id),
          isNull(collectionBottles.releaseId),
        ),
      );
  }

  if (bottleScopedFlightRows.length > 0) {
    await tx
      .insert(flightBottles)
      .values(
        bottleScopedFlightRows.map((row) => ({
          flightId: row.flightId,
          bottleId: bottle.id,
          releaseId: release.id,
        })),
      )
      .onConflictDoNothing();

    await tx
      .delete(flightBottles)
      .where(
        and(
          eq(flightBottles.bottleId, bottle.id),
          isNull(flightBottles.releaseId),
        ),
      );
  }

  await tx
    .update(bottleReleases)
    .set({
      totalTastings: sql`(SELECT COUNT(*) FROM ${tastings} WHERE ${tastings.releaseId} = ${release.id})`,
      avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${tastings.releaseId} = ${release.id} AND ${tastings.rating} IS NOT NULL)`,
    })
    .where(eq(bottleReleases.id, release.id));

  const [updatedBottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id))
    .limit(1);

  if (!updatedBottle) {
    throw new DirtyParentReleaseRepairBadRequestError("Bottle not found.");
  }

  await tx.insert(changes).values({
    objectType: "bottle",
    objectId: updatedBottle.id,
    createdById: user.id,
    displayName: updatedBottle.fullName,
    type: "update",
    data: {
      old: {
        ...bottle,
      },
      new: {
        ...updatedBottle,
      },
      changes: {
        ...(updatedBottle.name !== bottle.name
          ? {
              name: updatedBottle.name,
            }
          : {}),
        ...(updatedBottle.fullName !== bottle.fullName
          ? {
              fullName: updatedBottle.fullName,
            }
          : {}),
        edition: null,
        releaseYear: null,
        vintageYear: null,
        abv: null,
        singleCask: null,
        caskStrength: null,
        caskFill: null,
        caskType: null,
        caskSize: null,
        description: null,
        descriptionSrc: null,
        imageUrl: null,
        tastingNotes: null,
      },
    },
  });

  return {
    aliasNames: Array.from(aliasNames),
    bottleId: bottle.id,
    releaseId: release.id,
  };
}

export async function applyDirtyParentReleaseRepair({
  bottleId,
  user,
}: {
  bottleId: number;
  user: User;
}) {
  const result = await db.transaction(async (tx) =>
    applyDirtyParentReleaseRepairInTransaction(tx, {
      bottleId,
      user,
    }),
  );

  for (const aliasName of result.aliasNames) {
    try {
      await pushJob("OnBottleAliasChange", { name: aliasName });
    } catch (err) {
      logError(err, {
        alias: {
          name: aliasName,
        },
      });
    }
  }

  try {
    await pushJob("OnBottleReleaseChange", { releaseId: result.releaseId });
  } catch (err) {
    logError(err, {
      release: {
        id: result.releaseId,
      },
    });
  }

  try {
    await pushJob("OnBottleChange", { bottleId: result.bottleId });
  } catch (err) {
    logError(err, {
      bottle: {
        id: result.bottleId,
      },
    });
  }

  return result;
}
