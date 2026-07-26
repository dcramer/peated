import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import type { Bottle, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroups,
  bottleGroupTombstones,
  bottleObservations,
  bottleReleasePromotions,
  bottles,
  bottlesToDistillers,
  bottleTags,
  bottleTombstones,
  catalogTargets,
  changes,
  collectionBottles,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  tastings,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import {
  ConcreteBottleMergeAuthorizationError,
  ConcreteBottleMergeConflictError,
  ConcreteBottleMergeGraphError,
  finalizeConcreteBottleMerge,
  mergeConcreteBottles,
  mergeConcreteBottlesInTransaction,
} from "@peated/server/lib/mergeConcreteBottles";
import * as testFixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as dbSchema from "../db/schema";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForGroupLockWaiters(
  observer: NodePgClient,
  mergePids: number[],
) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await observer.query<{
      pid: number;
      query: string;
      waitEventType: string | null;
    }>(
      `SELECT
         pid,
         query,
         wait_event_type AS "waitEventType"
       FROM pg_stat_activity
       WHERE pid = ANY($1::int[])`,
      [mergePids],
    );
    if (
      result.rows.length === mergePids.length &&
      result.rows.every(
        ({ query, waitEventType }) =>
          waitEventType === "Lock" && query.includes('"bottle_group"'),
      )
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for exact Bottle merge group locks.");
}

function contextFor(user: User | null) {
  return { user } as Parameters<typeof mergeConcreteBottles>[0]["context"];
}

type GroupMemberExact = Omit<
  Parameters<typeof testFixtures.BottleGroupMember>[0],
  "groupId"
>;

async function createGroup(
  user: User,
  name: string,
  exacts: GroupMemberExact[],
  stable: Record<string, unknown> = {},
) {
  const first = await createConcreteBottle({
    context: contextFor(user) as Parameters<
      typeof createConcreteBottle
    >[0]["context"],
    input: {
      stable: { name, brand: { name: `${name} Brand` }, ...stable },
      exact: exacts[0],
    },
  });
  const members: Array<{ bottle: Bottle }> = [first];
  for (const exact of exacts.slice(1)) {
    members.push({
      bottle: await testFixtures.BottleGroupMember({
        groupId: first.group.id,
        ...exact,
      }),
    });
  }
  return { first, members };
}

async function exactTargetId(bottleId: number) {
  const [target] = await db
    .select({ id: catalogTargets.id })
    .from(catalogTargets)
    .where(eq(catalogTargets.bottleId, bottleId));
  if (!target) throw new Error(`Missing exact target for Bottle ${bottleId}.`);
  return target.id;
}

async function genericTargetId(groupId: number) {
  const [target] = await db
    .select({ id: catalogTargets.id })
    .from(catalogTargets)
    .where(
      and(eq(catalogTargets.groupId, groupId), isNull(catalogTargets.bottleId)),
    );
  if (!target) throw new Error(`Missing generic target for group ${groupId}.`);
  return target.id;
}

function resetQueueMock() {
  vi.mocked(workerClient.pushUniqueJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockResolvedValue(undefined);
}

describe("exact concrete Bottle merges", () => {
  beforeEach(resetQueueMock);

  test("authorizes the public boundary and rejects a cross-group representative with survivors", async ({
    defaults,
    fixtures,
  }) => {
    await expect(
      mergeConcreteBottles({
        sourceBottleId: 1,
        destinationBottleId: 2,
        context: contextFor(defaults.user),
      }),
    ).rejects.toBeInstanceOf(ConcreteBottleMergeAuthorizationError);

    const mod = await fixtures.User({ mod: true });
    const source = await createGroup(mod, "Representative Source", [
      { edition: "Representative" },
      { edition: "Survivor" },
    ]);
    const destination = await createGroup(mod, "Representative Destination", [
      { edition: "Destination" },
    ]);
    const sourceBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, source.first.bottle.id),
    });

    const error = await waitError(
      mergeConcreteBottles({
        sourceBottleId: source.first.bottle.id,
        destinationBottleId: destination.first.bottle.id,
        context: contextFor(mod),
      }),
    );

    expect(error).toMatchObject({
      code: "source_representative_has_survivors",
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, source.first.bottle.id),
      }),
    ).toEqual(sourceBefore);
  });

  test("rejects a canonical exact name already owned by either generic target", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    for (const owner of ["source", "destination"] as const) {
      const sourceGroup = await createGroup(mod, `Canonical ${owner} Source`, [
        { edition: "Duplicate" },
      ]);
      const destinationGroup = await createGroup(
        mod,
        `Canonical ${owner} Destination`,
        [{ edition: "Winner" }],
      );
      const source = sourceGroup.first.bottle;
      const destination = destinationGroup.first.bottle;
      const genericAliasTargetId = await genericTargetId(
        owner === "source"
          ? sourceGroup.first.group.id
          : destinationGroup.first.group.id,
      );
      const genericBottleId = owner === "source" ? source.id : destination.id;
      const [genericCanonicalAlias] = await db
        .update(bottleAliases)
        .set({
          bottleId: genericBottleId,
          targetId: genericAliasTargetId,
        })
        .where(eq(bottleAliases.name, source.fullName))
        .returning();
      expect(genericCanonicalAlias).toBeDefined();

      const error = await waitError(
        mergeConcreteBottles({
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          context: contextFor(mod),
        }),
      );

      expect(error).toMatchObject({ code: "identity_conflict" });
      expect(
        await db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, source.fullName),
        }),
      ).toEqual(genericCanonicalAlias);
      expect(
        await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
      ).toBeDefined();
      expect(
        await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, source.id),
        }),
      ).toBeUndefined();
    }
  });

  test("rejects canonical aliases with foreign or crossed ownership channels", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    for (const ownership of [
      "destination bottle with foreign exact target",
      "destination bottle with foreign generic target",
      "foreign bottle with source exact target",
      "source bottle with destination exact target",
      "destination bottle with source exact target",
    ] as const) {
      const sourceGroup = await createGroup(
        mod,
        `Foreign ownership ${ownership} source`,
        [{ edition: "Duplicate" }],
      );
      const destinationGroup = await createGroup(
        mod,
        `Foreign ownership ${ownership} destination`,
        [{ edition: "Winner" }],
      );
      const foreignGroup = await createGroup(
        mod,
        `Foreign ownership ${ownership} owner`,
        [{ edition: "Foreign" }],
      );
      const source = sourceGroup.first.bottle;
      const destination = destinationGroup.first.bottle;
      const foreign = foreignGroup.first.bottle;
      const sourceExactTargetId = await exactTargetId(source.id);
      const destinationExactTargetId = await exactTargetId(destination.id);
      const foreignExactTargetId = await exactTargetId(foreign.id);
      const foreignGenericTargetId = await genericTargetId(
        foreignGroup.first.group.id,
      );
      const [canonicalAliasBefore] = await db
        .update(bottleAliases)
        .set(
          ownership === "source bottle with destination exact target"
            ? { bottleId: source.id, targetId: destinationExactTargetId }
            : ownership === "destination bottle with source exact target"
              ? { bottleId: destination.id, targetId: sourceExactTargetId }
              : ownership === "foreign bottle with source exact target"
                ? { bottleId: foreign.id, targetId: sourceExactTargetId }
                : {
                    bottleId: destination.id,
                    targetId:
                      ownership ===
                      "destination bottle with foreign exact target"
                        ? foreignExactTargetId
                        : foreignGenericTargetId,
                  },
        )
        .where(eq(bottleAliases.name, source.fullName))
        .returning();

      const error = await waitError(
        mergeConcreteBottles({
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          context: contextFor(mod),
        }),
      );

      expect(error, ownership).toMatchObject({ code: "identity_conflict" });
      expect(
        await db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, source.fullName),
        }),
        ownership,
      ).toEqual(canonicalAliasBefore);
      expect(
        await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
        ownership,
      ).toBeDefined();
      expect(
        await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, source.id),
        }),
        ownership,
      ).toBeUndefined();
    }
  });

  test("rejects noncanonical source-exact aliases owned by another Bottle", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    for (const owner of ["destination", "foreign"] as const) {
      const sourceGroup = await createGroup(
        mod,
        `Noncanonical ${owner} source`,
        [{ edition: "Duplicate" }],
      );
      const destinationGroup = await createGroup(
        mod,
        `Noncanonical ${owner} destination`,
        [{ edition: "Winner" }],
      );
      const foreignGroup = await createGroup(
        mod,
        `Noncanonical ${owner} foreign`,
        [{ edition: "Foreign" }],
      );
      const source = sourceGroup.first.bottle;
      const destination = destinationGroup.first.bottle;
      const foreign = foreignGroup.first.bottle;
      const aliasName = `Noncanonical ${owner} source-exact alias`;
      const [aliasBefore] = await db
        .insert(bottleAliases)
        .values({
          name: aliasName,
          bottleId: owner === "destination" ? destination.id : foreign.id,
          targetId: await exactTargetId(source.id),
          assignedByActorId: source.createdByActorId,
        })
        .returning();

      const error = await waitError(
        mergeConcreteBottles({
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          context: contextFor(mod),
        }),
      );

      expect(error, owner).toMatchObject({ code: "invalid_catalog_graph" });
      expect(
        await db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, aliasName),
        }),
        owner,
      ).toEqual(aliasBefore);
      expect(
        await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
        owner,
      ).toBeDefined();
      expect(
        await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, source.id),
        }),
        owner,
      ).toBeUndefined();
    }
  });

  test("merges same-group non-representatives and then replaces the representative with the destination", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const distiller = await fixtures.Entity({ name: "Same Group Distiller" });
    const group = await createGroup(
      mod,
      "Same Group Merge",
      [
        { edition: "Representative", abv: 40 },
        { edition: "Duplicate Source", abv: 55 },
        { edition: "Duplicate Destination", abv: 46 },
      ],
      { distillers: [distiller.id], category: "single_malt" },
    );
    const representative = group.members[0]!.bottle;
    const source = group.members[1]!.bottle;
    const destination = group.members[2]!.bottle;
    const destinationBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, destination.id),
    });
    const destinationTargetId = await exactTargetId(destination.id);
    const groupGenericTargetId = await genericTargetId(group.first.group.id);
    const stableAlias = await db
      .insert(bottleAliases)
      .values({
        name: "Same Group Stable Alias",
        bottleId: source.id,
        targetId: groupGenericTargetId,
        assignedByActorId: source.createdByActorId,
      })
      .returning();

    await expect(
      mergeConcreteBottles({
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        context: contextFor(mod),
      }),
    ).resolves.toMatchObject({
      changed: true,
      destinationBottle: destinationBefore,
    });
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
    ).toBeUndefined();
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, destination.id),
      }),
    ).toEqual(destinationBefore);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, group.first.group.id),
      }),
    ).toMatchObject({
      representativeBottleId: representative.id,
      totalBottles: 2,
    });
    expect(await exactTargetId(destination.id)).toBe(destinationTargetId);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Same Group Stable Alias"),
      }),
    ).toMatchObject({ bottleId: null, targetId: groupGenericTargetId });
    const firstGroupMergeAudit = (
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle_group"),
            eq(changes.objectId, group.first.group.id),
          ),
        )
    ).find(({ data }) => data.updateScope === "exact_merge");
    expect(firstGroupMergeAudit?.data.stableAliasesBefore).toEqual([
      {
        ...stableAlias[0],
        createdAt: stableAlias[0]!.createdAt.toISOString(),
      },
    ]);

    await mergeConcreteBottles({
      sourceBottleId: representative.id,
      destinationBottleId: destination.id,
      context: contextFor(mod),
    });
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, group.first.group.id),
      }),
    ).toMatchObject({
      representativeBottleId: destination.id,
      totalBottles: 1,
    });
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, destination.id)),
    ).toEqual([{ bottleId: destination.id, distillerId: distiller.id }]);
  });

  test("merges a cross-group non-representative with exact consumers, aliases, promotions, and predecessor redirects", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const sourceDistiller = await fixtures.Entity({
      name: "Exact Source Distiller",
    });
    const destinationDistiller = await fixtures.Entity({
      name: "Exact Destination Distiller",
    });
    const sourceGroup = await createGroup(
      mod,
      "Cross Source",
      [{ edition: "Legacy Parent" }, { edition: "Duplicate" }],
      { distillers: [sourceDistiller.id] },
    );
    const destinationGroup = await createGroup(
      mod,
      "Cross Destination",
      [{ edition: "Winner", description: "Destination content" }],
      { distillers: [destinationDistiller.id] },
    );
    const parent = sourceGroup.first.bottle;
    const source = sourceGroup.members[1]!.bottle;
    const destination = destinationGroup.first.bottle;
    const sourceTargetId = await exactTargetId(source.id);
    const destinationTargetId = await exactTargetId(destination.id);
    const actor = await getUserActor(mod);
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: source.id,
      status: "promoted",
      createdByActorId: source.createdByActorId,
      auditMetadata: {
        retainedEvidence: "keep-me",
      },
    });
    const tasting = await fixtures.Tasting({
      bottleId: source.id,
      targetId: sourceTargetId,
    });
    const review = await fixtures.Review({
      bottleId: source.id,
      targetId: sourceTargetId,
    });
    const price = await fixtures.StorePrice({
      bottleId: source.id,
      targetId: sourceTargetId,
    });
    const [observation] = await db
      .insert(bottleObservations)
      .values({
        bottleId: source.id,
        targetId: sourceTargetId,
        sourceType: "store_price",
        sourceKey: "exact-merge-observation",
        sourceName: "Exact merge observation",
      })
      .returning();
    const [decisionLog] = await db
      .insert(incomingBottleDecisionLogs)
      .values({
        sourceKind: "store_price",
        sourceId: price.id,
        externalSiteId: price.externalSiteId,
        name: "Exact merge decision",
        decision: "match_existing",
        actorId: actor.id,
        bottleId: source.id,
        targetId: sourceTargetId,
      })
      .returning();
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "match_existing",
        currentBottleId: source.id,
        suggestedBottleId: source.id,
        parentBottleId: source.id,
        currentTargetId: sourceTargetId,
        suggestedTargetId: sourceTargetId,
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal!.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        currentBottleId: source.id,
        suggestedBottleId: source.id,
        parentBottleId: source.id,
        currentTargetId: sourceTargetId,
        suggestedTargetId: sourceTargetId,
      })
      .returning();
    await db.insert(bottleTags).values([
      { bottleId: source.id, tag: "coastal", count: 2 },
      { bottleId: source.id, tag: "smoky", count: 3 },
      { bottleId: destination.id, tag: "smoky", count: 2 },
    ]);
    await db.insert(bottleFlavorProfiles).values([
      { bottleId: source.id, flavorProfile: "peated", count: 4 },
      { bottleId: destination.id, flavorProfile: "peated", count: 1 },
    ]);
    await db.insert(bottleAliases).values({
      name: "Cross Source Historical Label",
      bottleId: source.id,
      targetId: sourceTargetId,
      releaseId: release.id,
      assignedByActorId: source.createdByActorId,
    });
    const predecessorId = 9_000_001;
    await db.insert(bottleTombstones).values({
      bottleId: predecessorId,
      newBottleId: source.id,
    });
    const destinationBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, destination.id),
    });

    await mergeConcreteBottles({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      context: contextFor(mod),
    });

    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, destination.id),
      }),
    ).toEqual(destinationBefore);
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, destination.id)),
    ).toEqual([
      { bottleId: destination.id, distillerId: destinationDistiller.id },
    ]);
    expect(
      await db.query.tastings.findFirst({ where: eq(tastings.id, tasting.id) }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationTargetId,
    });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationTargetId,
    });
    expect(
      await db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, observation!.id),
      }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationTargetId,
    });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: eq(incomingBottleDecisionLogs.id, decisionLog!.id),
      }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationTargetId,
    });
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal!.id),
      }),
    ).toMatchObject({
      currentBottleId: destination.id,
      suggestedBottleId: destination.id,
      parentBottleId: destination.id,
      currentTargetId: destinationTargetId,
      suggestedTargetId: destinationTargetId,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: (storePrices, { eq }) => eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationTargetId,
    });
    expect(
      await db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt!.id),
      }),
    ).toMatchObject({
      currentBottleId: destination.id,
      suggestedBottleId: destination.id,
      parentBottleId: destination.id,
      currentTargetId: destinationTargetId,
      suggestedTargetId: destinationTargetId,
    });
    expect(
      await db
        .select({
          bottleId: bottleTags.bottleId,
          tag: bottleTags.tag,
          count: bottleTags.count,
        })
        .from(bottleTags)
        .where(
          and(
            inArray(bottleTags.bottleId, [source.id, destination.id]),
            inArray(bottleTags.tag, ["coastal", "smoky"]),
          ),
        )
        .orderBy(asc(bottleTags.tag)),
    ).toEqual([
      { bottleId: destination.id, tag: "coastal", count: 2 },
      { bottleId: destination.id, tag: "smoky", count: 5 },
    ]);
    expect(
      await db
        .select({
          bottleId: bottleFlavorProfiles.bottleId,
          flavorProfile: bottleFlavorProfiles.flavorProfile,
          count: bottleFlavorProfiles.count,
        })
        .from(bottleFlavorProfiles)
        .where(
          and(
            inArray(bottleFlavorProfiles.bottleId, [source.id, destination.id]),
            eq(bottleFlavorProfiles.flavorProfile, "peated"),
          ),
        ),
    ).toEqual([
      {
        bottleId: destination.id,
        flavorProfile: "peated",
        count: 5,
      },
    ]);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Cross Source Historical Label"),
      }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationTargetId,
      releaseId: release.id,
    });
    expect(
      await db.query.bottleReleasePromotions.findFirst({
        where: eq(bottleReleasePromotions.releaseId, release.id),
      }),
    ).toMatchObject({
      promotedBottleId: destination.id,
      auditMetadata: {
        retainedEvidence: "keep-me",
        exactBottleMerges: [
          {
            sourceBottleId: source.id,
            sourceGroupId: sourceGroup.first.group.id,
            destinationBottleId: destination.id,
            destinationGroupId: destinationGroup.first.group.id,
          },
        ],
      },
    });
    expect(
      await db
        .select()
        .from(bottleTombstones)
        .where(inArray(bottleTombstones.bottleId, [predecessorId, source.id]))
        .orderBy(asc(bottleTombstones.bottleId)),
    ).toEqual([
      {
        bottleId: source.id,
        newBottleId: destination.id,
        newGroupId: null,
      },
      {
        bottleId: predecessorId,
        newBottleId: destination.id,
        newGroupId: null,
      },
    ]);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, sourceGroup.first.group.id),
      }),
    ).toMatchObject({
      representativeBottleId: parent.id,
      totalBottles: 1,
    });
    const mergeAudits = (
      await db
        .select()
        .from(changes)
        .where(inArray(changes.objectId, [source.id, destination.id]))
    ).filter(({ data }) => data.updateScope === "exact_merge");
    expect(mergeAudits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectType: "bottle",
          objectId: source.id,
          type: "delete",
          actorId: actor.id,
        }),
        expect.objectContaining({
          objectType: "bottle",
          objectId: destination.id,
          type: "update",
          actorId: actor.id,
        }),
      ]),
    );
    const sourceAudit = mergeAudits.find(
      ({ objectType, objectId }) =>
        objectType === "bottle" && objectId === source.id,
    );
    expect(
      sourceAudit?.data.exactConsumerPreimages.directTargets,
    ).toMatchObject({
      reviews: [{ id: review.id, targetId: sourceTargetId }],
      bottleObservations: [{ id: observation!.id, targetId: sourceTargetId }],
      incomingBottleDecisionLogs: [
        { id: decisionLog!.id, targetId: sourceTargetId },
      ],
    });
    expect(sourceAudit?.data.legacyConsumerPreimages).toMatchObject({
      reviews: [
        { id: review.id, bottleId: source.id, targetId: sourceTargetId },
      ],
      bottleObservations: [
        {
          id: observation!.id,
          bottleId: source.id,
          targetId: sourceTargetId,
        },
      ],
      incomingBottleDecisionLogs: [
        {
          id: decisionLog!.id,
          bottleId: source.id,
          targetId: sourceTargetId,
        },
      ],
    });
  });

  test("consolidates mixed exact and legacy collection and flight memberships", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const sourceGroup = await createGroup(mod, "Mixed Membership Source", [
      { edition: "Representative" },
      { edition: "Duplicate" },
    ]);
    const destinationGroup = await createGroup(
      mod,
      "Mixed Membership Destination",
      [{ edition: "Winner" }],
    );
    const source = sourceGroup.members[1]!.bottle;
    const destination = destinationGroup.first.bottle;
    const sourceTargetId = await exactTargetId(source.id);
    const destinationTargetId = await exactTargetId(destination.id);
    const exactSourceCollection = await fixtures.Collection({
      totalBottles: 2,
    });
    const legacySourceCollection = await fixtures.Collection({
      totalBottles: 2,
    });
    const [exactSourceCollectionRow, legacyDestinationCollectionRow] = await db
      .insert(collectionBottles)
      .values([
        {
          collectionId: exactSourceCollection.id,
          bottleId: source.id,
          targetId: sourceTargetId,
          imageUrl: "/mixed-source-exact.jpg",
          status: "sealed",
        },
        {
          collectionId: exactSourceCollection.id,
          bottleId: destination.id,
          targetId: null,
          imageUrl: null,
          status: "open",
        },
      ])
      .returning();
    const [legacySourceCollectionRow, exactDestinationCollectionRow] = await db
      .insert(collectionBottles)
      .values([
        {
          collectionId: legacySourceCollection.id,
          bottleId: source.id,
          targetId: null,
          imageUrl: "/mixed-source-legacy.jpg",
          status: "sealed",
        },
        {
          collectionId: legacySourceCollection.id,
          bottleId: destination.id,
          targetId: destinationTargetId,
          imageUrl: "/mixed-destination-exact.jpg",
          status: "empty",
        },
      ])
      .returning();
    const exactSourceFlight = await fixtures.Flight();
    const legacySourceFlight = await fixtures.Flight();
    const [exactSourceFlightRow, legacyDestinationFlightRow] = await db
      .insert(flightBottles)
      .values([
        {
          flightId: exactSourceFlight.id,
          bottleId: source.id,
          targetId: sourceTargetId,
        },
        {
          flightId: exactSourceFlight.id,
          bottleId: destination.id,
          targetId: null,
        },
      ])
      .returning();
    const [legacySourceFlightRow, exactDestinationFlightRow] = await db
      .insert(flightBottles)
      .values([
        {
          flightId: legacySourceFlight.id,
          bottleId: source.id,
          targetId: null,
        },
        {
          flightId: legacySourceFlight.id,
          bottleId: destination.id,
          targetId: destinationTargetId,
        },
      ])
      .returning();

    await mergeConcreteBottles({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      context: contextFor(mod),
    });

    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, exactSourceCollection.id)),
    ).toEqual([
      expect.objectContaining({
        id: legacyDestinationCollectionRow!.id,
        bottleId: destination.id,
        targetId: destinationTargetId,
        imageUrl: "/mixed-source-exact.jpg",
        status: "open",
      }),
    ]);
    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, legacySourceCollection.id)),
    ).toEqual([
      expect.objectContaining({
        id: exactDestinationCollectionRow!.id,
        bottleId: destination.id,
        targetId: destinationTargetId,
        imageUrl: "/mixed-destination-exact.jpg",
        status: "empty",
      }),
    ]);
    expect(
      await db.query.collections.findFirst({
        where: (collections, { eq }) =>
          eq(collections.id, exactSourceCollection.id),
      }),
    ).toMatchObject({ totalBottles: 1 });
    expect(
      await db.query.collections.findFirst({
        where: (collections, { eq }) =>
          eq(collections.id, legacySourceCollection.id),
      }),
    ).toMatchObject({ totalBottles: 1 });
    expect(
      await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, exactSourceFlight.id)),
    ).toEqual([
      expect.objectContaining({
        flightId: legacyDestinationFlightRow!.flightId,
        bottleId: destination.id,
        targetId: destinationTargetId,
      }),
    ]);
    expect(
      await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, legacySourceFlight.id)),
    ).toEqual([
      expect.objectContaining({
        flightId: exactDestinationFlightRow!.flightId,
        bottleId: destination.id,
        targetId: destinationTargetId,
      }),
    ]);

    const sourceAudit = (
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.objectId, source.id),
          ),
        )
    ).find(({ data }) => data.updateScope === "exact_merge");
    expect(
      sourceAudit?.data.exactConsumerPreimages.collections.sourceRows,
    ).toEqual([
      expect.objectContaining({
        id: exactSourceCollectionRow!.id,
        targetId: sourceTargetId,
      }),
    ]);
    expect(sourceAudit?.data.exactConsumerPreimages.flights).toEqual([
      expect.objectContaining({
        flightId: exactSourceFlightRow!.flightId,
        bottleId: source.id,
        targetId: sourceTargetId,
      }),
    ]);
    expect(sourceAudit?.data.legacyCollectionPreimages).toMatchObject({
      sourceRows: [
        { id: exactSourceCollectionRow!.id, targetId: destinationTargetId },
        { id: legacySourceCollectionRow!.id, targetId: null },
      ],
      destinationRowsBefore: [
        {
          id: legacyDestinationCollectionRow!.id,
          targetId: null,
          imageUrl: null,
        },
        {
          id: exactDestinationCollectionRow!.id,
          targetId: destinationTargetId,
          imageUrl: "/mixed-destination-exact.jpg",
        },
      ],
    });
    expect(sourceAudit?.data.legacyFlightPreimages).toMatchObject({
      sourceRows: [
        {
          flightId: exactSourceFlightRow!.flightId,
          bottleId: source.id,
          targetId: destinationTargetId,
        },
        {
          flightId: legacySourceFlightRow!.flightId,
          bottleId: source.id,
          targetId: null,
        },
      ],
      destinationRowsBefore: [
        {
          flightId: legacyDestinationFlightRow!.flightId,
          bottleId: destination.id,
          targetId: null,
        },
        {
          flightId: exactDestinationFlightRow!.flightId,
          bottleId: destination.id,
          targetId: destinationTargetId,
        },
      ],
    });
  });

  test("rejects legacy membership keys with incompatible generic destination intent", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    for (const surface of ["collection", "flight"] as const) {
      const sourceGroup = await createGroup(
        mod,
        `Generic collision ${surface} source`,
        [{ edition: "Duplicate" }],
      );
      const destinationGroup = await createGroup(
        mod,
        `Generic collision ${surface} destination`,
        [{ edition: "Winner" }],
      );
      const source = sourceGroup.first.bottle;
      const destination = destinationGroup.first.bottle;
      const sourceTargetId = await exactTargetId(source.id);
      const destinationGenericTargetId = await genericTargetId(
        destinationGroup.first.group.id,
      );
      let membershipsBefore: unknown[];

      if (surface === "collection") {
        const collection = await fixtures.Collection({ totalBottles: 2 });
        await db.insert(collectionBottles).values([
          {
            collectionId: collection.id,
            bottleId: source.id,
            targetId: sourceTargetId,
          },
          {
            collectionId: collection.id,
            bottleId: destination.id,
            targetId: destinationGenericTargetId,
          },
        ]);
        membershipsBefore = await db
          .select()
          .from(collectionBottles)
          .where(eq(collectionBottles.collectionId, collection.id))
          .orderBy(asc(collectionBottles.id));
      } else {
        const flight = await fixtures.Flight();
        await db.insert(flightBottles).values([
          {
            flightId: flight.id,
            bottleId: source.id,
            targetId: sourceTargetId,
          },
          {
            flightId: flight.id,
            bottleId: destination.id,
            targetId: destinationGenericTargetId,
          },
        ]);
        membershipsBefore = await db
          .select()
          .from(flightBottles)
          .where(eq(flightBottles.flightId, flight.id))
          .orderBy(asc(flightBottles.bottleId));
      }

      const error = await waitError(
        mergeConcreteBottles({
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          context: contextFor(mod),
        }),
      );

      expect(error, surface).toBeInstanceOf(ConcreteBottleMergeConflictError);
      expect(error, surface).toMatchObject({ code: "consumer_conflict" });
      expect(
        surface === "collection"
          ? await db
              .select()
              .from(collectionBottles)
              .where(
                inArray(collectionBottles.bottleId, [
                  source.id,
                  destination.id,
                ]),
              )
              .orderBy(asc(collectionBottles.id))
          : await db
              .select()
              .from(flightBottles)
              .where(
                inArray(flightBottles.bottleId, [source.id, destination.id]),
              )
              .orderBy(asc(flightBottles.bottleId)),
        surface,
      ).toEqual(membershipsBefore);
      expect(
        await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
        surface,
      ).toBeDefined();
      expect(
        await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, source.id),
        }),
        surface,
      ).toBeUndefined();
    }
  });

  test("rejects generic source intent that would collide during legacy repointing", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    for (const { topology, surface } of [
      { topology: "same-group", surface: "collection" },
      { topology: "cross-group survivor", surface: "flight" },
      { topology: "retiring singleton", surface: "collection" },
    ] as const) {
      let sourceGroup: Awaited<ReturnType<typeof createGroup>>;
      let destinationGroup: Awaited<ReturnType<typeof createGroup>>;
      if (topology === "same-group") {
        sourceGroup = await createGroup(mod, `Generic ${topology}`, [
          { edition: "Destination" },
          { edition: "Source" },
        ]);
        destinationGroup = sourceGroup;
      } else if (topology === "cross-group survivor") {
        sourceGroup = await createGroup(mod, `Generic ${topology} source`, [
          { edition: "Representative" },
          { edition: "Source" },
        ]);
        destinationGroup = await createGroup(
          mod,
          `Generic ${topology} destination`,
          [{ edition: "Destination" }],
        );
      } else {
        sourceGroup = await createGroup(mod, `Generic ${topology} source`, [
          { edition: "Source" },
        ]);
        destinationGroup = await createGroup(
          mod,
          `Generic ${topology} destination`,
          [{ edition: "Destination" }],
        );
      }
      const source =
        topology === "retiring singleton"
          ? sourceGroup.first.bottle
          : sourceGroup.members[1]!.bottle;
      const destination = destinationGroup.first.bottle;
      const sourceGenericTargetId = await genericTargetId(
        sourceGroup.first.group.id,
      );
      const destinationTargetId = await exactTargetId(destination.id);
      let membershipOwnerId: number;
      let membershipsBefore: unknown[];

      if (surface === "collection") {
        const collection = await fixtures.Collection({ totalBottles: 2 });
        membershipOwnerId = collection.id;
        await db.insert(collectionBottles).values([
          {
            collectionId: collection.id,
            bottleId: source.id,
            targetId: sourceGenericTargetId,
          },
          {
            collectionId: collection.id,
            bottleId: destination.id,
            targetId: destinationTargetId,
          },
        ]);
        membershipsBefore = await db
          .select()
          .from(collectionBottles)
          .where(eq(collectionBottles.collectionId, membershipOwnerId))
          .orderBy(asc(collectionBottles.id));
      } else {
        const flight = await fixtures.Flight();
        membershipOwnerId = flight.id;
        await db.insert(flightBottles).values([
          {
            flightId: flight.id,
            bottleId: source.id,
            targetId: sourceGenericTargetId,
          },
          {
            flightId: flight.id,
            bottleId: destination.id,
            targetId: destinationTargetId,
          },
        ]);
        membershipsBefore = await db
          .select()
          .from(flightBottles)
          .where(eq(flightBottles.flightId, membershipOwnerId))
          .orderBy(asc(flightBottles.bottleId));
      }

      const error = await waitError(
        mergeConcreteBottles({
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          context: contextFor(mod),
        }),
      );

      expect(error, topology).toBeInstanceOf(ConcreteBottleMergeConflictError);
      expect(error, topology).toMatchObject({ code: "consumer_conflict" });
      expect(
        surface === "collection"
          ? await db
              .select()
              .from(collectionBottles)
              .where(eq(collectionBottles.collectionId, membershipOwnerId))
              .orderBy(asc(collectionBottles.id))
          : await db
              .select()
              .from(flightBottles)
              .where(eq(flightBottles.flightId, membershipOwnerId))
              .orderBy(asc(flightBottles.bottleId)),
        topology,
      ).toEqual(membershipsBefore);
      expect(
        await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
        topology,
      ).toBeDefined();
      expect(
        await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, source.id),
        }),
        topology,
      ).toBeUndefined();
    }
  });

  test("rejects corrupt promotion metadata and rolls back the complete merge", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const corruptMetadataCases: Array<{
      label: string;
      value: unknown;
    }> = [
      {
        label: "malformed merge history",
        value: {
          retainedEvidence: "keep-me",
          exactBottleMerges: "malformed-history",
        },
      },
      { label: "top-level array", value: [] },
      { label: "top-level scalar", value: "malformed-metadata" },
    ];

    for (const { label, value } of corruptMetadataCases) {
      const sourceGroup = await createGroup(mod, `Corrupt ${label} Source`, [
        { edition: "Parent" },
        { edition: "Duplicate" },
      ]);
      const destinationGroup = await createGroup(
        mod,
        `Corrupt ${label} Destination`,
        [{ edition: "Winner" }],
      );
      const parent = sourceGroup.first.bottle;
      const source = sourceGroup.members[1]!.bottle;
      const destination = destinationGroup.first.bottle;
      const release = await fixtures.BottleRelease({ bottleId: parent.id });
      await db.insert(bottleReleasePromotions).values({
        releaseId: release.id,
        promotedBottleId: source.id,
        status: "promoted",
        createdByActorId: source.createdByActorId,
        auditMetadata: value as Record<string, unknown>,
      });
      const bottleIds = [source.id, destination.id];
      const bottlesBefore = await db
        .select()
        .from(bottles)
        .where(inArray(bottles.id, bottleIds))
        .orderBy(asc(bottles.id));
      const aliasesBefore = await db
        .select()
        .from(bottleAliases)
        .where(inArray(bottleAliases.bottleId, bottleIds))
        .orderBy(asc(bottleAliases.name));
      const promotionBefore = await db.query.bottleReleasePromotions.findFirst({
        where: eq(bottleReleasePromotions.releaseId, release.id),
      });

      const error = await waitError(
        mergeConcreteBottles({
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          context: contextFor(mod),
        }),
      );

      expect(error, label).toBeInstanceOf(ConcreteBottleMergeGraphError);
      expect(error, label).toMatchObject({
        code: "invalid_catalog_graph",
        bottleId: source.id,
      });

      expect(
        await db
          .select()
          .from(bottles)
          .where(inArray(bottles.id, bottleIds))
          .orderBy(asc(bottles.id)),
      ).toEqual(bottlesBefore);
      expect(
        await db
          .select()
          .from(bottleAliases)
          .where(inArray(bottleAliases.bottleId, bottleIds))
          .orderBy(asc(bottleAliases.name)),
      ).toEqual(aliasesBefore);
      expect(
        await db.query.bottleReleasePromotions.findFirst({
          where: eq(bottleReleasePromotions.releaseId, release.id),
        }),
      ).toEqual(promotionBefore);
      expect(
        await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, source.id),
        }),
      ).toBeUndefined();
    }
  });

  test("retires a singleton source group while preserving generic intent and legacy null-target set rules", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const sourceGroup = await createGroup(mod, "Singleton Source", [
      { edition: "Only Bottle" },
    ]);
    const destinationGroup = await createGroup(mod, "Singleton Destination", [
      { edition: "Winner" },
    ]);
    const source = sourceGroup.first.bottle;
    const destination = destinationGroup.first.bottle;
    const sourceGenericTargetId = await genericTargetId(
      sourceGroup.first.group.id,
    );
    const destinationGenericTargetId = await genericTargetId(
      destinationGroup.first.group.id,
    );
    const genericTasting = await fixtures.Tasting({
      bottleId: source.id,
      targetId: sourceGenericTargetId,
    });
    await db.insert(bottleAliases).values({
      name: "Singleton Stable Alias",
      bottleId: source.id,
      targetId: sourceGenericTargetId,
      assignedByActorId: source.createdByActorId,
    });
    const retiredParentId = 9_000_004;
    await db.insert(bottleTombstones).values({
      bottleId: retiredParentId,
      newGroupId: sourceGroup.first.group.id,
    });
    const collection = await fixtures.Collection({ totalBottles: 2 });
    const flight = await fixtures.Flight();
    await db.insert(collectionBottles).values([
      {
        collectionId: collection.id,
        bottleId: source.id,
        targetId: null,
        imageUrl: "/source.jpg",
      },
      {
        collectionId: collection.id,
        bottleId: destination.id,
        targetId: null,
        imageUrl: null,
      },
    ]);
    await db.insert(flightBottles).values([
      { flightId: flight.id, bottleId: source.id, targetId: null },
      { flightId: flight.id, bottleId: destination.id, targetId: null },
    ]);

    await mergeConcreteBottles({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      context: contextFor(mod),
    });

    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, sourceGroup.first.group.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleGroupTombstones.findFirst({
        where: eq(bottleGroupTombstones.groupId, sourceGroup.first.group.id),
      }),
    ).toMatchObject({ newGroupId: destinationGroup.first.group.id });
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, retiredParentId),
      }),
    ).toEqual({
      bottleId: retiredParentId,
      newBottleId: null,
      newGroupId: destinationGroup.first.group.id,
    });
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, source.id),
      }),
    ).toEqual({
      bottleId: source.id,
      newBottleId: destination.id,
      newGroupId: null,
    });
    const [sourceGroupAudit] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle_group"),
          eq(changes.objectId, sourceGroup.first.group.id),
          eq(changes.type, "delete"),
        ),
      );
    expect(sourceGroupAudit.data.predecessorBottleTombstonesBefore).toEqual([
      {
        bottleId: retiredParentId,
        newBottleId: null,
        newGroupId: sourceGroup.first.group.id,
      },
    ]);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, genericTasting.id),
      }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationGenericTargetId,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Singleton Stable Alias"),
      }),
    ).toMatchObject({
      bottleId: destination.id,
      targetId: destinationGenericTargetId,
    });
    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collection.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: destination.id,
        targetId: null,
        imageUrl: "/source.jpg",
      }),
    ]);
    expect(
      await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, flight.id)),
    ).toEqual([
      expect.objectContaining({ bottleId: destination.id, targetId: null }),
    ]);
    await expect(
      mergeConcreteBottles({
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        context: contextFor(mod),
      }),
    ).resolves.toMatchObject({ changed: false });
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, retiredParentId),
      }),
    ).toMatchObject({ newGroupId: destinationGroup.first.group.id });
  });

  test("rolls back target collisions and makes tombstone retries inert", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const sourceGroup = await createGroup(mod, "Collision Source", [
      { edition: "Source" },
    ]);
    const destinationGroup = await createGroup(mod, "Collision Destination", [
      { edition: "Destination" },
    ]);
    const source = sourceGroup.first.bottle;
    const destination = destinationGroup.first.bottle;
    const user = await fixtures.User();
    const createdAt = new Date("2026-07-15T17:00:00.000Z");
    await fixtures.Tasting({
      bottleId: source.id,
      targetId: await exactTargetId(source.id),
      createdById: user.id,
      createdAt,
    });
    await fixtures.Tasting({
      bottleId: destination.id,
      targetId: await exactTargetId(destination.id),
      createdById: user.id,
      createdAt,
    });

    const error = await waitError(
      mergeConcreteBottles({
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        context: contextFor(mod),
      }),
    );
    expect(error).toBeInstanceOf(ConcreteBottleMergeConflictError);
    expect(error).toMatchObject({ code: "consumer_conflict" });
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
    ).toBeDefined();

    await db.delete(tastings).where(eq(tastings.bottleId, destination.id));
    await mergeConcreteBottles({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      context: contextFor(mod),
    });
    const auditCount = (
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            inArray(changes.objectId, [source.id, destination.id]),
          ),
        )
    ).length;
    resetQueueMock();
    const retry = await mergeConcreteBottles({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      context: contextFor(mod),
    });
    expect(retry).toMatchObject({
      changed: false,
      destinationBottle: { id: destination.id },
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    expect(
      (
        await db
          .select()
          .from(changes)
          .where(
            and(
              eq(changes.objectType, "bottle"),
              inArray(changes.objectId, [source.id, destination.id]),
            ),
          )
      ).length,
    ).toBe(auditCount);

    const other = await createGroup(mod, "Other Destination", [
      { edition: "Other" },
    ]);
    await expect(
      mergeConcreteBottles({
        sourceBottleId: source.id,
        destinationBottleId: other.first.bottle.id,
        context: contextFor(mod),
      }),
    ).rejects.toMatchObject({ code: "retired_to_other_destination" });

    const destinationTargetId = await exactTargetId(destination.id);
    await db.delete(tastings).where(eq(tastings.bottleId, destination.id));
    await db
      .update(bottleAliases)
      .set({ targetId: null })
      .where(eq(bottleAliases.targetId, destinationTargetId));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.id, destinationTargetId));
    await expect(
      mergeConcreteBottles({
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        context: contextFor(mod),
      }),
    ).rejects.toMatchObject({ code: "invalid_catalog_graph" });
  });

  test("serializes concurrent identical merges through BottleGroups before Bottles", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const source = await createGroup(mod, "Concurrent Merge Source", [
      { edition: "Source" },
    ]);
    const destination = await createGroup(mod, "Concurrent Merge Destination", [
      { edition: "Destination" },
    ]);
    const groupIds = [source.first.group.id, destination.first.group.id].sort(
      (left, right) => left - right,
    );
    const bottleIds = [
      source.first.bottle.id,
      destination.first.bottle.id,
    ].sort((left, right) => left - right);
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    const firstMergeClient = new Client(getPostgresConnectionConfig());
    const secondMergeClient = new Client(getPostgresConnectionConfig());
    let merges: Promise<
      [
        Awaited<ReturnType<typeof mergeConcreteBottlesInTransaction>>,
        Awaited<ReturnType<typeof mergeConcreteBottlesInTransaction>>,
      ]
    > | null = null;

    await blocker.connect();
    await observer.connect();
    await firstMergeClient.connect();
    await secondMergeClient.connect();
    try {
      const actor = await getUserActor(mod);
      const firstMergeDb = drizzle(firstMergeClient, { schema: dbSchema });
      const secondMergeDb = drizzle(secondMergeClient, { schema: dbSchema });
      const mergePids = await Promise.all(
        [firstMergeClient, secondMergeClient].map(async (client) => {
          const pid = (
            await client.query<{ pid: number }>(
              "SELECT pg_backend_pid() AS pid",
            )
          ).rows[0]?.pid;
          if (!pid) throw new Error("Unable to load merge client pid.");
          return pid;
        }),
      );
      await blocker.query("BEGIN");
      await blocker.query(
        `SELECT id
         FROM bottle_group
         WHERE id = ANY($1::bigint[])
         ORDER BY id
         FOR UPDATE`,
        [groupIds],
      );

      merges = Promise.all([
        firstMergeDb.transaction((tx) =>
          mergeConcreteBottlesInTransaction(tx, {
            sourceBottleId: source.first.bottle.id,
            destinationBottleId: destination.first.bottle.id,
            actorId: actor.id,
          }),
        ),
        secondMergeDb.transaction((tx) =>
          mergeConcreteBottlesInTransaction(tx, {
            sourceBottleId: source.first.bottle.id,
            destinationBottleId: destination.first.bottle.id,
            actorId: actor.id,
          }),
        ),
      ]);
      void merges.catch(() => undefined);
      await waitForGroupLockWaiters(observer, mergePids);

      await observer.query("BEGIN");
      await expect(
        observer.query(
          `SELECT id
           FROM bottle
           WHERE id = ANY($1::bigint[])
           ORDER BY id
           FOR UPDATE NOWAIT`,
          [bottleIds],
        ),
      ).resolves.toBeDefined();
      await observer.query("ROLLBACK");

      await blocker.query("COMMIT");
      const results = await merges;
      expect(results.map(({ changed }) => changed).sort()).toEqual([
        false,
        true,
      ]);
      expect(
        await db.query.bottles.findFirst({
          where: eq(bottles.id, source.first.bottle.id),
        }),
      ).toBeUndefined();
      expect(
        await db.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, source.first.bottle.id),
        }),
      ).toMatchObject({ newBottleId: destination.first.bottle.id });
      expect(
        await db.query.bottleGroups.findFirst({
          where: eq(bottleGroups.id, source.first.group.id),
        }),
      ).toBeUndefined();
      expect(
        await db.query.bottleGroupTombstones.findFirst({
          where: eq(bottleGroupTombstones.groupId, source.first.group.id),
        }),
      ).toMatchObject({ newGroupId: destination.first.group.id });
    } finally {
      await blocker.query("ROLLBACK").catch(() => undefined);
      await observer.query("ROLLBACK").catch(() => undefined);
      await firstMergeClient.query("ROLLBACK").catch(() => undefined);
      await secondMergeClient.query("ROLLBACK").catch(() => undefined);
      await blocker.end();
      await observer.end();
      await firstMergeClient.end();
      await secondMergeClient.end();
    }
  });

  test("returns a post-commit manifest to a trusted outer transaction", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const source = await createGroup(mod, "Manifest Source", [
      { edition: "Source" },
    ]);
    const destination = await createGroup(mod, "Manifest Destination", [
      { edition: "Destination" },
    ]);
    resetQueueMock();

    const manifest = await db.transaction((tx) =>
      mergeConcreteBottlesInTransaction(tx, {
        sourceBottleId: source.first.bottle.id,
        destinationBottleId: destination.first.bottle.id,
        actorId: actor.id,
      }),
    );

    expect(manifest).toMatchObject({
      changed: true,
      destinationBottleId: destination.first.bottle.id,
      destinationBottle: { id: destination.first.bottle.id },
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    await finalizeConcreteBottleMerge(manifest);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: destination.first.bottle.id,
    });
  });
});
