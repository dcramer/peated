import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleObservations,
  bottleReleases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
  collectionBottles,
  entities,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import {
  getCanonicalReleaseAliasNames,
  hasBottleLevelReleaseTraits,
} from "@peated/server/lib/bottleSchemaRules";
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
import { pushJob } from "@peated/server/worker/client";
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";

type RepairBottle = Pick<
  Bottle,
  | "abv"
  | "bottlerId"
  | "brandId"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "createdById"
  | "description"
  | "edition"
  | "fullName"
  | "id"
  | "imageUrl"
  | "name"
  | "numReleases"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "tastingNotes"
  | "totalTastings"
  | "vintageYear"
>;

export class LegacyReleaseRepairBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyReleaseRepairBadRequestError";
  }
}

type ApplyLegacyReleaseRepairResult = {
  aliasNames: string[];
  legacyBottleId: number;
  parentBottleId: number;
  releaseId: number;
};

function getReleaseInput(legacyBottle: RepairBottle) {
  const repairIdentity = deriveLegacyReleaseRepairIdentity({
    fullName: legacyBottle.fullName,
    edition: legacyBottle.edition,
    releaseYear: legacyBottle.releaseYear,
  });

  if (!repairIdentity) {
    throw new LegacyReleaseRepairBadRequestError(
      "Bottle does not contain reusable release identity.",
    );
  }

  return {
    releaseIdentity: repairIdentity,
    input: {
      edition: repairIdentity.edition,
      statedAge: legacyBottle.statedAge,
      abv: legacyBottle.abv,
      caskStrength: legacyBottle.caskStrength,
      singleCask: legacyBottle.singleCask,
      vintageYear: legacyBottle.vintageYear,
      releaseYear: repairIdentity.releaseYear,
      caskType: legacyBottle.caskType,
      caskSize: legacyBottle.caskSize,
      caskFill: legacyBottle.caskFill,
      description: legacyBottle.description,
      tastingNotes: legacyBottle.tastingNotes,
      imageUrl: legacyBottle.imageUrl,
    },
  };
}

async function getLegacyBottleForRepair(
  tx: AnyTransaction,
  legacyBottleId: number,
) {
  const [legacyBottle] = await tx
    .select({
      id: bottles.id,
      name: bottles.name,
      fullName: bottles.fullName,
      statedAge: bottles.statedAge,
      edition: bottles.edition,
      abv: bottles.abv,
      singleCask: bottles.singleCask,
      caskStrength: bottles.caskStrength,
      vintageYear: bottles.vintageYear,
      releaseYear: bottles.releaseYear,
      caskType: bottles.caskType,
      caskSize: bottles.caskSize,
      caskFill: bottles.caskFill,
      description: bottles.description,
      imageUrl: bottles.imageUrl,
      tastingNotes: bottles.tastingNotes,
      brandId: bottles.brandId,
      bottlerId: bottles.bottlerId,
      createdById: bottles.createdById,
      numReleases: bottles.numReleases,
      totalTastings: bottles.totalTastings,
    })
    .from(bottles)
    .where(eq(bottles.id, legacyBottleId))
    .limit(1)
    .for("update");

  if (!legacyBottle) {
    throw new LegacyReleaseRepairBadRequestError("Bottle not found.");
  }

  if (legacyBottle.numReleases > 0) {
    throw new LegacyReleaseRepairBadRequestError(
      "Bottle already owns child releases.",
    );
  }

  return legacyBottle satisfies RepairBottle;
}

async function getExactParentBottle(
  tx: AnyTransaction,
  {
    legacyBottleId,
    proposedParentFullName,
  }: {
    legacyBottleId: number;
    proposedParentFullName: string;
  },
) {
  const [parentBottle] = await tx
    .select()
    .from(bottles)
    .where(
      and(
        eq(
          sql`LOWER(${bottles.fullName})`,
          proposedParentFullName.toLowerCase(),
        ),
        sql`${bottles.id} != ${legacyBottleId}`,
      ),
    )
    .orderBy(sql`${bottles.totalTastings} DESC NULLS LAST`, desc(bottles.id))
    .limit(1)
    .for("update");

  if (!parentBottle) {
    throw new LegacyReleaseRepairBadRequestError(
      "No exact reusable parent bottle exists for this repair.",
    );
  }

  if (hasBottleLevelReleaseTraits(parentBottle)) {
    throw new LegacyReleaseRepairBadRequestError(
      "Exact parent bottle still contains bottle-level release traits.",
    );
  }

  return parentBottle;
}

export async function applyLegacyReleaseRepairInTransaction(
  tx: AnyTransaction,
  {
    legacyBottleId,
    user,
  }: {
    legacyBottleId: number;
    user: User;
  },
): Promise<ApplyLegacyReleaseRepairResult> {
  const legacyBottle = await getLegacyBottleForRepair(tx, legacyBottleId);
  const { input: releaseInput, releaseIdentity } =
    getReleaseInput(legacyBottle);
  const parentBottle = await getExactParentBottle(tx, {
    legacyBottleId,
    proposedParentFullName: releaseIdentity.proposedParentFullName,
  });

  const legacyAliases = await tx.query.bottleAliases.findMany({
    where: eq(bottleAliases.bottleId, legacyBottle.id),
  });
  const legacyReviews = await tx
    .select({ id: reviews.id, name: reviews.name })
    .from(reviews)
    .where(eq(reviews.bottleId, legacyBottle.id));
  const legacyStorePrices = await tx
    .select({ id: storePrices.id, name: storePrices.name })
    .from(storePrices)
    .where(eq(storePrices.bottleId, legacyBottle.id));
  const legacyTags = await tx.query.bottleTags.findMany({
    where: eq(bottleTags.bottleId, legacyBottle.id),
  });
  const legacyFlavorProfiles = await tx.query.bottleFlavorProfiles.findMany({
    where: eq(bottleFlavorProfiles.bottleId, legacyBottle.id),
  });
  const distillerIds = (
    await tx
      .select({ distillerId: bottlesToDistillers.distillerId })
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, legacyBottle.id))
  ).map((row) => row.distillerId);

  if (legacyAliases.length > 0) {
    await tx
      .update(bottleAliases)
      .set({
        bottleId: null,
        releaseId: null,
      })
      .where(eq(bottleAliases.bottleId, legacyBottle.id));
  }

  let releaseId: number;
  try {
    const result = await createBottleReleaseInTransaction(tx, {
      bottleId: parentBottle.id,
      input: releaseInput,
      user,
    });
    releaseId = result.release.id;
  } catch (err) {
    if (err instanceof BottleReleaseAlreadyExistsError) {
      releaseId = err.releaseId;
    } else if (err instanceof BottleReleaseCreateBadRequestError) {
      throw new LegacyReleaseRepairBadRequestError(err.message);
    } else {
      throw err;
    }
  }

  const repairedAliasNames = new Set<string>();

  const [release] = await tx
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, releaseId))
    .limit(1);
  if (!release) {
    throw new LegacyReleaseRepairBadRequestError("Bottle release not found.");
  }

  for (const aliasName of getCanonicalReleaseAliasNames({
    fullName: release.fullName,
  })) {
    const alias = await upsertBottleAlias(
      tx,
      aliasName,
      parentBottle.id,
      release.id,
    );
    if (
      alias.bottleId !== parentBottle.id ||
      (alias.releaseId ?? null) !== release.id
    ) {
      throw new LegacyReleaseRepairBadRequestError(
        "Release alias already belongs to a different bottle.",
      );
    }
    repairedAliasNames.add(aliasName);
  }

  for (const alias of legacyAliases) {
    const scope = resolveLegacyReleaseRepairNameScope({
      name: alias.name,
      proposedParentFullName: parentBottle.fullName,
      releaseIdentity: {
        edition: releaseIdentity.edition,
        releaseYear: releaseIdentity.releaseYear,
      },
    });

    await tx
      .update(bottleAliases)
      .set({
        bottleId: parentBottle.id,
        releaseId: scope === "release" ? release.id : null,
      })
      .where(eq(bottleAliases.name, alias.name));

    repairedAliasNames.add(alias.name);
  }

  for (const review of legacyReviews) {
    const scope = resolveLegacyReleaseRepairNameScope({
      name: review.name,
      proposedParentFullName: parentBottle.fullName,
      releaseIdentity: {
        edition: releaseIdentity.edition,
        releaseYear: releaseIdentity.releaseYear,
      },
    });

    await tx
      .update(reviews)
      .set({
        bottleId: parentBottle.id,
        releaseId: scope === "release" ? release.id : null,
      })
      .where(eq(reviews.id, review.id));
  }

  for (const storePrice of legacyStorePrices) {
    const scope = resolveLegacyReleaseRepairNameScope({
      name: storePrice.name,
      proposedParentFullName: parentBottle.fullName,
      releaseIdentity: {
        edition: releaseIdentity.edition,
        releaseYear: releaseIdentity.releaseYear,
      },
    });

    await tx
      .update(storePrices)
      .set({
        bottleId: parentBottle.id,
        releaseId: scope === "release" ? release.id : null,
      })
      .where(eq(storePrices.id, storePrice.id));
  }

  await Promise.all([
    tx
      .update(tastings)
      .set({
        bottleId: parentBottle.id,
        releaseId: release.id,
      })
      .where(eq(tastings.bottleId, legacyBottle.id)),

    tx
      .update(collectionBottles)
      .set({
        bottleId: parentBottle.id,
        releaseId: release.id,
      })
      .where(eq(collectionBottles.bottleId, legacyBottle.id)),

    tx
      .update(flightBottles)
      .set({
        bottleId: parentBottle.id,
        releaseId: release.id,
      })
      .where(eq(flightBottles.bottleId, legacyBottle.id)),

    tx
      .update(bottleObservations)
      .set({
        bottleId: parentBottle.id,
        releaseId: release.id,
      })
      .where(eq(bottleObservations.bottleId, legacyBottle.id)),
  ]);

  for (const row of legacyTags) {
    await tx
      .insert(bottleTags)
      .values({
        bottleId: parentBottle.id,
        tag: row.tag,
        count: row.count,
      })
      .onConflictDoUpdate({
        target: [bottleTags.bottleId, bottleTags.tag],
        set: {
          count: sql<number>`${bottleTags.count} + ${row.count}`,
        },
      });
  }

  for (const row of legacyFlavorProfiles) {
    await tx
      .insert(bottleFlavorProfiles)
      .values({
        bottleId: parentBottle.id,
        flavorProfile: row.flavorProfile,
        count: row.count,
      })
      .onConflictDoUpdate({
        target: [
          bottleFlavorProfiles.bottleId,
          bottleFlavorProfiles.flavorProfile,
        ],
        set: {
          count: sql<number>`${bottleFlavorProfiles.count} + ${row.count}`,
        },
      });
  }

  if (distillerIds.length > 0) {
    await tx
      .insert(bottlesToDistillers)
      .values(
        distillerIds.map((distillerId) => ({
          bottleId: parentBottle.id,
          distillerId,
        })),
      )
      .onConflictDoNothing();
  }

  await tx
    .update(storePriceMatchProposals)
    .set({
      currentBottleId: sql`CASE WHEN ${storePriceMatchProposals.currentBottleId} = ${legacyBottle.id} THEN NULL ELSE ${storePriceMatchProposals.currentBottleId} END`,
      currentReleaseId: sql`CASE WHEN ${storePriceMatchProposals.currentBottleId} = ${legacyBottle.id} THEN NULL ELSE ${storePriceMatchProposals.currentReleaseId} END`,
      suggestedBottleId: sql`CASE WHEN ${storePriceMatchProposals.suggestedBottleId} = ${legacyBottle.id} THEN NULL ELSE ${storePriceMatchProposals.suggestedBottleId} END`,
      suggestedReleaseId: sql`CASE WHEN ${storePriceMatchProposals.suggestedBottleId} = ${legacyBottle.id} THEN NULL ELSE ${storePriceMatchProposals.suggestedReleaseId} END`,
      parentBottleId: sql`CASE WHEN ${storePriceMatchProposals.parentBottleId} = ${legacyBottle.id} THEN NULL ELSE ${storePriceMatchProposals.parentBottleId} END`,
      status: sql`CASE
        WHEN ${storePriceMatchProposals.status} IN ('approved', 'verified')
          THEN 'pending_review'::store_price_match_proposal_status
        ELSE ${storePriceMatchProposals.status}
      END`,
      reviewedById: sql`CASE
        WHEN ${storePriceMatchProposals.status} IN ('approved', 'verified')
          THEN NULL
        ELSE ${storePriceMatchProposals.reviewedById}
      END`,
      reviewedAt: sql`CASE
        WHEN ${storePriceMatchProposals.status} IN ('approved', 'verified')
          THEN NULL
        ELSE ${storePriceMatchProposals.reviewedAt}
      END`,
      updatedAt: sql`NOW()`,
    })
    .where(
      or(
        eq(storePriceMatchProposals.currentBottleId, legacyBottle.id),
        eq(storePriceMatchProposals.suggestedBottleId, legacyBottle.id),
        eq(storePriceMatchProposals.parentBottleId, legacyBottle.id),
      ),
    );

  const entityIds = Array.from(
    new Set([
      legacyBottle.brandId,
      ...distillerIds,
      legacyBottle.bottlerId,
    ]).values(),
  ).filter((id): id is number => id !== null);

  await Promise.all([
    tx.insert(changes).values({
      objectType: "bottle",
      objectId: legacyBottle.id,
      createdById: user.id,
      displayName: legacyBottle.fullName,
      type: "delete",
      data: {
        ...legacyBottle,
        distillerIds,
      },
    }),

    tx.insert(bottleTombstones).values({
      bottleId: legacyBottle.id,
      newBottleId: parentBottle.id,
    }),

    tx.delete(bottleTags).where(eq(bottleTags.bottleId, legacyBottle.id)),

    tx
      .delete(bottleFlavorProfiles)
      .where(eq(bottleFlavorProfiles.bottleId, legacyBottle.id)),

    tx
      .delete(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, legacyBottle.id)),
  ]);

  if (entityIds.length > 0) {
    await tx
      .update(entities)
      .set({ totalBottles: sql`${entities.totalBottles} - 1` })
      .where(
        and(inArray(entities.id, entityIds), gt(entities.totalBottles, 0)),
      );
  }

  await tx
    .update(bottleReleases)
    .set({
      totalTastings: sql`(SELECT COUNT(*) FROM ${tastings} WHERE ${tastings.releaseId} = ${release.id})`,
      avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${tastings.releaseId} = ${release.id} AND ${tastings.rating} IS NOT NULL)`,
    })
    .where(eq(bottleReleases.id, release.id));

  await tx.delete(bottles).where(eq(bottles.id, legacyBottle.id));

  return {
    aliasNames: Array.from(repairedAliasNames),
    legacyBottleId: legacyBottle.id,
    parentBottleId: parentBottle.id,
    releaseId: release.id,
  };
}

export async function applyLegacyReleaseRepair({
  legacyBottleId,
  user,
}: {
  legacyBottleId: number;
  user: User;
}) {
  const result = await db.transaction(async (tx) =>
    applyLegacyReleaseRepairInTransaction(tx, {
      legacyBottleId,
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
    await pushJob("OnBottleChange", { bottleId: result.parentBottleId });
  } catch (err) {
    logError(err, {
      bottle: {
        id: result.parentBottleId,
      },
    });
  }

  return result;
}
