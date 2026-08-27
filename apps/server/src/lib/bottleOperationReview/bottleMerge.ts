import type { ProposedOperation } from "@peated/bottle-classifier";
import type { AnyDatabase } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleObservations,
  bottleTags,
  bottleTombstones,
  bottles,
  collectionBottles,
  externalReviews,
  flightBottles,
  incomingBottleDecisionLogs,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { PreparedBottleMergeDataSchema } from "../bottleOperationReviewSchemas";
import {
  bottleExact,
  bottlePreviewState,
  loadBottle,
  type BottleResource,
} from "./bottleShared";
import {
  bottleRelationshipStates,
  relationshipStateForGroups,
} from "./relationships";
import {
  fail,
  relationshipDigest,
  requireInspectedBottle,
  sortedUnique,
  type ParsedPreparationContext,
  type PreparedOperationExecution,
} from "./shared";

function bottleMergeIdentityState(resource: BottleResource) {
  return {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    fullName: resource.bottle.fullName,
    shared: {
      name: resource.group.name,
      statedAge: resource.group.statedAge,
      seriesId: resource.group.seriesId,
      category: resource.group.category,
      brandId: resource.group.brandId,
      distillerIds: resource.distillerIds,
      bottlerId: resource.group.bottlerId,
    },
    exact: bottleExact(resource),
    aliasDigest: relationshipDigest(resource.aliases),
    tombstoneDestinationBottleId: resource.tombstoneDestinationBottleId,
  };
}

async function bottleMergeConsumerPreview(
  database: AnyDatabase,
  sourceBottleId: number,
  destinationBottleId: number,
) {
  const tastingCount = await database
    .select({ total: count() })
    .from(tastings)
    .where(eq(tastings.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const reviewCount = await database
    .select({ total: count() })
    .from(externalReviews)
    .where(eq(externalReviews.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const storePriceCount = await database
    .select({ total: count() })
    .from(storePrices)
    .where(eq(storePrices.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const observationCount = await database
    .select({ total: count() })
    .from(bottleObservations)
    .where(eq(bottleObservations.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const collectionCount = await database
    .select({ total: count() })
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const flightCount = await database
    .select({ total: count() })
    .from(flightBottles)
    .where(eq(flightBottles.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const aliasCount = await database
    .select({ total: count() })
    .from(bottleAliases)
    .where(eq(bottleAliases.bottleId, sourceBottleId))
    .then(([row]) => row?.total ?? 0);
  const collectionCollisions = await database
    .select({
      total: countDistinct(collectionBottles.collectionId),
    })
    .from(collectionBottles)
    .where(
      and(
        eq(collectionBottles.bottleId, sourceBottleId),
        sql`EXISTS (
            SELECT 1
            FROM collection_bottle destination_membership
            WHERE destination_membership.collection_id = ${collectionBottles.collectionId}
              AND destination_membership.bottle_id = ${destinationBottleId}
          )`,
      ),
    )
    .then(([row]) => row?.total ?? 0);
  const flightCollisions = await database
    .select({ total: countDistinct(flightBottles.flightId) })
    .from(flightBottles)
    .where(
      and(
        eq(flightBottles.bottleId, sourceBottleId),
        sql`EXISTS (
            SELECT 1
            FROM flight_bottle destination_membership
            WHERE destination_membership.flight_id = ${flightBottles.flightId}
              AND destination_membership.bottle_id = ${destinationBottleId}
          )`,
      ),
    )
    .then(([row]) => row?.total ?? 0);
  const tastingCollisions = await database
    .select({ total: count() })
    .from(tastings)
    .where(
      and(
        eq(tastings.bottleId, sourceBottleId),
        sql`EXISTS (
            SELECT 1
            FROM tasting destination_tasting
            WHERE destination_tasting.bottle_id = ${destinationBottleId}
              AND destination_tasting.created_by_id = ${tastings.createdById}
              AND destination_tasting.created_at = ${tastings.createdAt}
          )`,
      ),
    )
    .then(([row]) => row?.total ?? 0);
  if (tastingCollisions > 0) {
    fail(
      "direct_conflict",
      "Bottle merge would violate an existing tasting identity.",
    );
  }
  return {
    consumers: {
      tastings: tastingCount,
      externalReviews: reviewCount,
      storePrices: storePriceCount,
      observations: observationCount,
      collectionMemberships: collectionCount,
      flightMemberships: flightCount,
      aliases: aliasCount,
    },
    membershipCollisions: {
      collections: collectionCollisions,
      flights: flightCollisions,
    },
  };
}

async function bottleMergeRelationshipState(
  database: AnyDatabase,
  source: BottleResource,
  destination: BottleResource,
) {
  const bottleIds = [source.bottle.id, destination.bottle.id];
  const groupIds = sortedUnique([source.group.id, destination.group.id]);
  const bottleGroupsState = await relationshipStateForGroups(
    database,
    groupIds,
  );
  const memberBottleIds = await database
    .select({ bottleId: bottles.id })
    .from(bottles)
    .where(inArray(bottles.groupId, groupIds))
    .orderBy(asc(bottles.id))
    .then((rows) => rows.map(({ bottleId }) => bottleId));
  const bottleStates = await bottleRelationshipStates(
    database,
    memberBottleIds,
  );
  const tastingRows = await database
    .select({ id: tastings.id })
    .from(tastings)
    .where(inArray(tastings.bottleId, bottleIds))
    .orderBy(asc(tastings.id));
  const reviewRows = await database
    .select({ id: externalReviews.id })
    .from(externalReviews)
    .where(inArray(externalReviews.bottleId, bottleIds))
    .orderBy(asc(externalReviews.id));
  const storePriceRows = await database
    .select({ id: storePrices.id })
    .from(storePrices)
    .where(inArray(storePrices.bottleId, bottleIds))
    .orderBy(asc(storePrices.id));
  const observationRows = await database
    .select({ id: bottleObservations.id })
    .from(bottleObservations)
    .where(inArray(bottleObservations.bottleId, bottleIds))
    .orderBy(asc(bottleObservations.id));
  const decisionLogRows = await database
    .select({ id: incomingBottleDecisionLogs.id })
    .from(incomingBottleDecisionLogs)
    .where(inArray(incomingBottleDecisionLogs.bottleId, bottleIds))
    .orderBy(asc(incomingBottleDecisionLogs.id));
  const collectionRows = await database
    .select({
      membershipId: collectionBottles.id,
      collectionId: collectionBottles.collectionId,
      bottleId: collectionBottles.bottleId,
    })
    .from(collectionBottles)
    .where(inArray(collectionBottles.bottleId, bottleIds))
    .orderBy(asc(collectionBottles.collectionId), asc(collectionBottles.id));
  const flightRows = await database
    .select({
      flightId: flightBottles.flightId,
      bottleId: flightBottles.bottleId,
    })
    .from(flightBottles)
    .where(inArray(flightBottles.bottleId, bottleIds))
    .orderBy(asc(flightBottles.flightId), asc(flightBottles.bottleId));
  const matchProposalRows = await database
    .select({
      proposalId: storePriceMatchProposals.id,
      currentBottleId: storePriceMatchProposals.currentBottleId,
      suggestedBottleId: storePriceMatchProposals.suggestedBottleId,
    })
    .from(storePriceMatchProposals)
    .where(
      or(
        inArray(storePriceMatchProposals.currentBottleId, bottleIds),
        inArray(storePriceMatchProposals.suggestedBottleId, bottleIds),
      ),
    )
    .orderBy(asc(storePriceMatchProposals.id));
  const matchAttemptRows = await database
    .select({
      attemptId: storePriceMatchAttempts.id,
      currentBottleId: storePriceMatchAttempts.currentBottleId,
      suggestedBottleId: storePriceMatchAttempts.suggestedBottleId,
    })
    .from(storePriceMatchAttempts)
    .where(
      or(
        inArray(storePriceMatchAttempts.currentBottleId, bottleIds),
        inArray(storePriceMatchAttempts.suggestedBottleId, bottleIds),
      ),
    )
    .orderBy(asc(storePriceMatchAttempts.id));
  const tagRows = await database
    .select({ bottleId: bottleTags.bottleId, tag: bottleTags.tag })
    .from(bottleTags)
    .where(inArray(bottleTags.bottleId, bottleIds))
    .orderBy(asc(bottleTags.bottleId), asc(bottleTags.tag));
  const flavorRows = await database
    .select({
      bottleId: bottleFlavorProfiles.bottleId,
      flavorProfile: bottleFlavorProfiles.flavorProfile,
    })
    .from(bottleFlavorProfiles)
    .where(inArray(bottleFlavorProfiles.bottleId, bottleIds))
    .orderBy(
      asc(bottleFlavorProfiles.bottleId),
      asc(bottleFlavorProfiles.flavorProfile),
    );
  const tombstoneRows = await database
    .select({
      bottleId: bottleTombstones.bottleId,
      destinationBottleId: bottleTombstones.newBottleId,
    })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.newBottleId, bottleIds))
    .orderBy(asc(bottleTombstones.bottleId));
  const [canonicalAlias] = await database
    .select({ bottleId: bottleAliases.bottleId })
    .from(bottleAliases)
    .where(
      eq(
        sql`LOWER(${bottleAliases.name})`,
        source.bottle.fullName.toLowerCase(),
      ),
    )
    .limit(1);
  return {
    bottleGroups: bottleGroupsState,
    bottles: bottleStates,
    tastingIds: tastingRows.map(({ id }) => id),
    reviewIds: reviewRows.map(({ id }) => id),
    storePriceIds: storePriceRows.map(({ id }) => id),
    observationIds: observationRows.map(({ id }) => id),
    incomingDecisionLogIds: decisionLogRows.map(({ id }) => id),
    collectionMemberships: collectionRows,
    flightMemberships: flightRows,
    matchProposals: matchProposalRows,
    matchAttempts: matchAttemptRows,
    tags: tagRows,
    flavorProfiles: flavorRows,
    canonicalAliasBottleId: canonicalAlias?.bottleId ?? null,
    incomingTombstones: tombstoneRows.filter(
      (
        row,
      ): row is {
        bottleId: number;
        destinationBottleId: number;
      } => row.destinationBottleId !== null,
    ),
  };
}

export async function prepareBottleMerge(
  proposal: Extract<ProposedOperation, { type: "merge_bottles" }>,
  context: ParsedPreparationContext,
): Promise<Extract<PreparedOperationExecution, { type: "merge_bottles" }>> {
  const { sourceBottleId, destinationBottleId } = proposal.input;
  requireInspectedBottle(sourceBottleId, context);
  requireInspectedBottle(destinationBottleId, context);
  if (context.protectedBottleIds.has(sourceBottleId)) {
    fail(
      "direct_conflict",
      `Bottle ${sourceBottleId} is protected by the primary resolution decision.`,
    );
  }
  const source = await loadBottle(context.database, sourceBottleId);
  const destination = await loadBottle(context.database, destinationBottleId);
  const impact = await bottleMergeConsumerPreview(
    context.database,
    sourceBottleId,
    destinationBottleId,
  );
  const relationships = await bottleMergeRelationshipState(
    context.database,
    source,
    destination,
  );
  const canonicalAliasOwnerId = relationships.canonicalAliasBottleId;
  if (
    canonicalAliasOwnerId !== null &&
    !relationships.bottles.some(
      ({ bottleId }) => bottleId === canonicalAliasOwnerId,
    )
  ) {
    fail(
      "identity_collision",
      `Bottle identity "${source.bottle.fullName}" conflicts with an alias assigned to Bottle ${canonicalAliasOwnerId}.`,
    );
  }
  const collisionTotal =
    impact.membershipCollisions.collections +
    impact.membershipCollisions.flights;
  const warnings =
    collisionTotal > 0
      ? [
          {
            code: "consumer_memberships_collapse" as const,
            message: `${collisionTotal} duplicate collection or flight memberships will collapse into the survivor.`,
          },
        ]
      : [];

  return {
    type: proposal.type,
    review: PreparedBottleMergeDataSchema.parse({
      type: proposal.type,
      proposal,
      preview: {
        source: bottlePreviewState(source),
        destination: bottlePreviewState(destination),
        outcome: {
          retiredBottleId: sourceBottleId,
          survivorBottleId: destinationBottleId,
          tombstoneDestinationBottleId: destinationBottleId,
        },
        ...impact,
        warnings,
      },
      stateToken: {
        source: bottleMergeIdentityState(source),
        destination: bottleMergeIdentityState(destination),
        relationshipDigest: relationshipDigest(relationships),
      },
    }),
    canonicalInput: {
      sourceBottleId,
      destinationBottleId,
    },
  };
}
