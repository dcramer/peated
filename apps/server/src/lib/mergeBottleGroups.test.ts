import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottleGroups,
  bottleObservations,
  bottleSeries,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  changes,
  collectionBottles,
  collections,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import {
  BottleGroupMergeAuthorizationError,
  BottleGroupMergeConflictError,
  BottleGroupMergeGraphError,
  BottleGroupMergeInputError,
  mergeBottleGroups,
} from "@peated/server/lib/mergeBottleGroups";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/worker/client";
import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

function contextFor(user: User | null) {
  return { user } as Parameters<typeof mergeBottleGroups>[0]["context"];
}

async function createGroup({
  user,
  stable,
  exacts,
}: {
  user: User;
  stable: Record<string, unknown>;
  exacts: Array<Record<string, unknown>>;
}) {
  const first = await createConcreteBottle({
    context: contextFor(user) as Parameters<
      typeof createConcreteBottle
    >[0]["context"],
    input: { kind: "independent", stable, exact: exacts[0] },
  });
  const members = [first];
  for (const exact of exacts.slice(1)) {
    members.push(
      await createConcreteBottle({
        context: contextFor(user) as Parameters<
          typeof createConcreteBottle
        >[0]["context"],
        input: {
          kind: "source_bottle",
          sourceBottleId: first.bottle.id,
          exact,
        },
      }),
    );
  }
  return { first, members };
}

async function loadTargets(groupId: number) {
  return await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, groupId))
    .orderBy(asc(catalogTargets.id));
}

function resetQueueMock() {
  vi.mocked(workerClient.pushUniqueJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockResolvedValue(undefined);
}

describe("BottleGroup merges", () => {
  beforeEach(() => {
    resetQueueMock();
  });

  test("authorizes and validates before resolving catalog state", async ({
    defaults,
    fixtures,
  }) => {
    for (const user of [null, defaults.user]) {
      expect(
        await waitError(
          mergeBottleGroups({
            sourceGroupId: 0,
            destinationGroupId: 0,
            context: contextFor(user),
          }),
        ),
      ).toBeInstanceOf(BottleGroupMergeAuthorizationError);
    }

    const mod = await fixtures.User({ mod: true });
    expect(
      await waitError(
        mergeBottleGroups({
          sourceGroupId: 0,
          destinationGroupId: 1,
          context: contextFor(mod),
        }),
      ),
    ).toBeInstanceOf(BottleGroupMergeInputError);
    expect(
      await waitError(
        mergeBottleGroups({
          sourceGroupId: 1,
          destinationGroupId: 1,
          context: contextFor(mod),
        }),
      ),
    ).toMatchObject({ code: "same_group" });
    expect(
      await waitError(
        mergeBottleGroups({
          sourceGroupId: 999_998,
          destinationGroupId: 999_999,
          context: contextFor(mod),
        }),
      ),
    ).toMatchObject({ code: "not_found", groupId: 999_998 });
  });

  test("allows at most one Bottle tombstone destination", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      db.insert(bottleTombstones).values({
        bottleId: 9_000_001,
        newBottleId: bottle.id,
        newGroupId: bottle.groupId,
      }),
    ).rejects.toBeDefined();
    await expect(
      db.insert(bottleTombstones).values({ bottleId: 9_000_002 }),
    ).resolves.toBeDefined();
  });

  test("moves exact members under destination shared identity and writes reversible audits", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const sourceBrand = await fixtures.Entity({ name: "Merge Source Brand" });
    const destinationBrand = await fixtures.Entity({
      name: "Merge Destination Brand",
    });
    const sourceSeries = await fixtures.BottleSeries({
      name: "Merge Source Series",
      brandId: sourceBrand.id,
    });
    const destinationSeries = await fixtures.BottleSeries({
      name: "Merge Destination Series",
      brandId: destinationBrand.id,
    });
    const sourceDistiller = await fixtures.Entity({
      name: "Merge Source Distiller",
    });
    const destinationDistiller = await fixtures.Entity({
      name: "Merge Destination Distiller",
    });
    const source = await createGroup({
      user: mod,
      stable: {
        name: "Source Expression",
        statedAge: 12,
        brand: sourceBrand.id,
        series: sourceSeries.id,
        distillers: [sourceDistiller.id],
        category: "single_malt",
        flavorProfile: "peated",
      },
      exacts: [
        {
          edition: "Inherited Age Batch",
          abv: 46,
          description: "Exact source description",
          descriptionSrc: "user",
        },
        {
          edition: "Fifteen Year Batch",
          statedAge: 15,
          abv: 55.5,
        },
      ],
    });
    const destination = await createGroup({
      user: mod,
      stable: {
        name: "Destination Expression",
        statedAge: 18,
        brand: destinationBrand.id,
        series: destinationSeries.id,
        distillers: [destinationDistiller.id],
        category: "blend",
        flavorProfile: "sweet_fruit_mellow",
      },
      exacts: [{ edition: "Destination Batch", abv: 43 }],
    });
    await db
      .update(bottles)
      .set({ imageUrl: "/images/exact-source.jpg" })
      .where(eq(bottles.id, source.members[0]!.bottle.id));
    const sourceTargets = await loadTargets(source.first.group.id);
    const exactTargetByBottleId = new Map(
      sourceTargets.flatMap((target) =>
        target.bottleId === null ? [] : [[target.bottleId, target.id] as const],
      ),
    );
    const exactIdentityBefore = source.members.map(({ bottle }) => ({
      bottleId: bottle.id,
      fullName: bottle.fullName,
      targetId: exactTargetByBottleId.get(bottle.id)!,
    }));
    const canonicalAliasesBefore = await db
      .select()
      .from(bottleAliases)
      .where(
        inArray(
          bottleAliases.name,
          exactIdentityBefore.map(({ fullName }) => fullName),
        ),
      );
    for (const identity of exactIdentityBefore) {
      expect(
        canonicalAliasesBefore.find(({ name }) => name === identity.fullName),
      ).toMatchObject({
        name: identity.fullName,
        bottleId: identity.bottleId,
      });
    }
    await db
      .update(bottleSeries)
      .set({ numReleases: source.members.length })
      .where(eq(bottleSeries.id, sourceSeries.id));
    await db
      .update(bottleSeries)
      .set({ numReleases: destination.members.length })
      .where(eq(bottleSeries.id, destinationSeries.id));
    resetQueueMock();
    vi.mocked(workerClient.pushUniqueJob).mockRejectedValueOnce(
      new Error("queue unavailable"),
    );

    const result = await mergeBottleGroups({
      sourceGroupId: source.first.group.id,
      destinationGroupId: destination.first.group.id,
      context: contextFor(mod),
    });

    expect(result).toEqual({
      sourceGroupId: source.first.group.id,
      destinationGroupId: destination.first.group.id,
      changed: true,
      movedBottleIds: source.members.map(({ bottle }) => bottle.id),
    });
    const moved = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, result.movedBottleIds))
      .orderBy(asc(bottles.id));
    expect(moved[0]).toMatchObject({
      groupId: destination.first.group.id,
      brandId: destinationBrand.id,
      seriesId: destinationSeries.id,
      name: expect.stringContaining("Destination Expression"),
      statedAge: 18,
      edition: "Inherited Age Batch",
      abv: 46,
      description: "Exact source description",
      imageUrl: "/images/exact-source.jpg",
      category: "blend",
      flavorProfile: "sweet_fruit_mellow",
    });
    expect(moved[1]).toMatchObject({
      groupId: destination.first.group.id,
      statedAge: 15,
      edition: "Fifteen Year Batch",
      abv: 55.5,
    });
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(inArray(bottlesToDistillers.bottleId, result.movedBottleIds))
        .orderBy(
          asc(bottlesToDistillers.bottleId),
          asc(bottlesToDistillers.distillerId),
        ),
    ).toEqual(
      result.movedBottleIds.map((bottleId) => ({
        bottleId,
        distillerId: destinationDistiller.id,
      })),
    );
    const movedTargets = await db
      .select()
      .from(catalogTargets)
      .where(inArray(catalogTargets.bottleId, result.movedBottleIds));
    expect(movedTargets).toEqual(
      expect.arrayContaining(
        result.movedBottleIds.map((bottleId) =>
          expect.objectContaining({
            id: exactTargetByBottleId.get(bottleId),
            bottleId,
            groupId: destination.first.group.id,
          }),
        ),
      ),
    );
    const retainedCanonicalAliases = await db
      .select()
      .from(bottleAliases)
      .where(
        inArray(
          bottleAliases.name,
          exactIdentityBefore.map(({ fullName }) => fullName),
        ),
      );
    for (const identity of exactIdentityBefore) {
      expect(
        retainedCanonicalAliases.find(({ name }) => name === identity.fullName),
      ).toMatchObject({
        name: identity.fullName,
        bottleId: identity.bottleId,
        targetId: identity.targetId,
      });
    }
    expect(
      await db
        .select({ id: bottleSeries.id, numReleases: bottleSeries.numReleases })
        .from(bottleSeries)
        .where(
          inArray(bottleSeries.id, [sourceSeries.id, destinationSeries.id]),
        )
        .orderBy(asc(bottleSeries.id)),
    ).toEqual(
      [
        { id: sourceSeries.id, numReleases: 0 },
        {
          id: destinationSeries.id,
          numReleases: source.members.length + destination.members.length,
        },
      ].sort((left, right) => left.id - right.id),
    );
    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, source.first.group.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(bottleGroupTombstones)
        .where(eq(bottleGroupTombstones.groupId, source.first.group.id)),
    ).toEqual([
      expect.objectContaining({
        groupId: source.first.group.id,
        newGroupId: destination.first.group.id,
      }),
    ]);

    const mergeAudits = await db
      .select()
      .from(changes)
      .where(
        and(
          inArray(changes.objectId, [
            ...result.movedBottleIds,
            source.first.group.id,
            destination.first.group.id,
          ]),
          inArray(changes.type, ["update", "delete"]),
        ),
      );
    const bottleAudits = mergeAudits.filter(
      ({ objectType }) => objectType === "bottle",
    );
    expect(bottleAudits).toHaveLength(2);
    expect(bottleAudits[0]!.data).toMatchObject({
      updateScope: "group_merge",
      sourceGroupId: source.first.group.id,
      destinationGroupId: destination.first.group.id,
      before: {
        groupId: source.first.group.id,
        targetId: expect.any(Number),
        distillerIds: [sourceDistiller.id],
      },
      after: {
        groupId: destination.first.group.id,
        targetId: expect.any(Number),
        distillerIds: [destinationDistiller.id],
      },
      retainedAliasNames: expect.any(Array),
      aliasMutations: expect.any(Array),
    });
    const normalizationUnstableIdentity = exactIdentityBefore.find(
      ({ fullName }) => fullName.includes("Fifteen Year Batch"),
    )!;
    const normalizationUnstableAudit = bottleAudits.find(
      ({ objectId }) => objectId === normalizationUnstableIdentity.bottleId,
    )!;
    expect(normalizationUnstableAudit.data.aliasMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: normalizationUnstableIdentity.fullName,
          bottleId: normalizationUnstableIdentity.bottleId,
          targetId: normalizationUnstableIdentity.targetId,
          before: expect.objectContaining({
            name: normalizationUnstableIdentity.fullName,
            bottleId: normalizationUnstableIdentity.bottleId,
            targetId: null,
          }),
        }),
        expect.objectContaining({
          name: expect.stringContaining("Merge Destination Brand"),
          bottleId: normalizationUnstableIdentity.bottleId,
          targetId: normalizationUnstableIdentity.targetId,
          before: null,
        }),
      ]),
    );
    const groupAudits = mergeAudits.filter(
      ({ objectType }) => objectType === "bottle_group",
    );
    expect(groupAudits).toHaveLength(2);
    expect(groupAudits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: source.first.group.id,
          type: "delete",
          data: expect.objectContaining({ before: expect.any(Object) }),
        }),
        expect.objectContaining({
          objectId: destination.first.group.id,
          type: "update",
          data: expect.objectContaining({
            before: expect.any(Object),
            after: expect.any(Object),
          }),
        }),
      ]),
    );
    expect(
      vi
        .mocked(workerClient.pushUniqueJob)
        .mock.calls.filter(([jobName]) => jobName === "OnBottleChange")
        .map(([, payload]) => payload),
    ).toEqual(
      source.members.map(({ exactTarget }) => ({ targetId: exactTarget.id })),
    );
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnEntityChange", {
      entityId: sourceBrand.id,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnEntityChange", {
      entityId: destinationBrand.id,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSeriesSearchVectors",
      { seriesId: sourceSeries.id },
    );
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSeriesSearchVectors",
      { seriesId: destinationSeries.id },
    );
  });

  test("consolidates every generic consumer while preserving destination payload and exact references", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const sourceBrand = await fixtures.Entity({
      name: "Consumer Source Brand",
    });
    const destinationBrand = await fixtures.Entity({
      name: "Consumer Destination Brand",
    });
    const source = await createGroup({
      user: mod,
      stable: {
        name: "Consumer Source",
        brand: sourceBrand.id,
        distillers: [],
      },
      exacts: [{ edition: "Consumer Source Batch", abv: 50 }],
    });
    const destination = await createGroup({
      user: mod,
      stable: {
        name: "Consumer Destination",
        brand: destinationBrand.id,
        distillers: [],
      },
      exacts: [{ edition: "Consumer Destination Batch", abv: 40 }],
    });
    const sourceTargets = await loadTargets(source.first.group.id);
    const destinationTargets = await loadTargets(destination.first.group.id);
    const sourceGeneric = sourceTargets.find(
      ({ bottleId }) => bottleId === null,
    )!;
    const sourceExact = sourceTargets.find(
      ({ bottleId }) => bottleId !== null,
    )!;
    const destinationGeneric = destinationTargets.find(
      ({ bottleId }) => bottleId === null,
    )!;
    const externalSite = await fixtures.ExternalSite();
    const sourcePrice = await fixtures.StorePrice({
      bottleId: source.first.bottle.id,
      targetId: sourceGeneric.id,
      externalSiteId: externalSite.id,
      name: "Generic source listing",
      url: "https://example.test/generic-source",
    });
    const exactPrice = await fixtures.StorePrice({
      bottleId: source.first.bottle.id,
      targetId: sourceExact.id,
      externalSiteId: externalSite.id,
      name: "Exact source listing",
      url: "https://example.test/exact-source",
    });
    const nullPrice = await fixtures.StorePrice({
      bottleId: source.first.bottle.id,
      targetId: null,
      externalSiteId: externalSite.id,
      name: "Null target listing",
      url: "https://example.test/null-source",
    });
    const review = await fixtures.Review({
      bottleId: source.first.bottle.id,
      targetId: sourceGeneric.id,
      externalSiteId: externalSite.id,
      name: "Generic source review",
      issue: "Merge issue",
      url: "https://example.test/review-source",
    });
    const tasting = await fixtures.Tasting({
      bottleId: source.first.bottle.id,
      targetId: sourceGeneric.id,
      createdById: mod.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await fixtures.Tasting({
      bottleId: destination.first.bottle.id,
      targetId: destinationGeneric.id,
      createdById: mod.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const [observation] = await db
      .insert(bottleObservations)
      .values({
        bottleId: source.first.bottle.id,
        targetId: sourceGeneric.id,
        sourceType: "store_price",
        sourceKey: "merge-generic-observation",
        sourceName: "Generic observation",
      })
      .returning();
    const [decisionLog] = await db
      .insert(incomingBottleDecisionLogs)
      .values({
        sourceKind: "store_price",
        sourceId: sourcePrice.id,
        externalSiteId: externalSite.id,
        name: "Generic decision",
        decision: "match_existing",
        actorId: actor.id,
        bottleId: source.first.bottle.id,
        targetId: sourceGeneric.id,
      })
      .returning();
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: sourcePrice.id,
        proposalType: "match_existing",
        currentBottleId: source.first.bottle.id,
        currentTargetId: sourceGeneric.id,
        suggestedBottleId: source.first.bottle.id,
        suggestedTargetId: sourceExact.id,
        parentBottleId: source.first.bottle.id,
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: sourcePrice.id,
        proposalId: proposal.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        currentBottleId: source.first.bottle.id,
        currentTargetId: sourceExact.id,
        suggestedBottleId: source.first.bottle.id,
        suggestedTargetId: sourceGeneric.id,
        parentBottleId: source.first.bottle.id,
      })
      .returning();
    const duplicateCollection = await fixtures.Collection({ totalBottles: 2 });
    const sourceOnlyCollection = await fixtures.Collection({ totalBottles: 1 });
    await db.insert(collectionBottles).values([
      {
        collectionId: duplicateCollection.id,
        bottleId: source.first.bottle.id,
        targetId: sourceGeneric.id,
        imageUrl: "/source-image.jpg",
        status: "sealed",
      },
      {
        collectionId: duplicateCollection.id,
        bottleId: destination.first.bottle.id,
        targetId: destinationGeneric.id,
        imageUrl: "   ",
        status: "open",
      },
      {
        collectionId: sourceOnlyCollection.id,
        bottleId: source.first.bottle.id,
        targetId: sourceGeneric.id,
        imageUrl: "/source-only.jpg",
        status: "empty",
      },
    ]);
    const duplicateFlight = await fixtures.Flight();
    const sourceOnlyFlight = await fixtures.Flight();
    await db.insert(flightBottles).values([
      {
        flightId: duplicateFlight.id,
        bottleId: source.first.bottle.id,
        targetId: sourceGeneric.id,
      },
      {
        flightId: duplicateFlight.id,
        bottleId: destination.first.bottle.id,
        targetId: destinationGeneric.id,
      },
      {
        flightId: sourceOnlyFlight.id,
        bottleId: source.first.bottle.id,
        targetId: sourceGeneric.id,
      },
    ]);
    await db.insert(bottleAliases).values({
      bottleId: null,
      targetId: sourceGeneric.id,
      name: "Retargeted Stable Merge Alias",
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
    const [duplicateCollectionBefore] = await db
      .select({ totalBottles: collections.totalBottles })
      .from(collections)
      .where(eq(collections.id, duplicateCollection.id));
    expect(duplicateCollectionBefore.totalBottles).toBe(2);
    resetQueueMock();

    await mergeBottleGroups({
      sourceGroupId: source.first.group.id,
      destinationGroupId: destination.first.group.id,
      context: contextFor(mod),
    });

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    const [updatedObservation] = await db
      .select()
      .from(bottleObservations)
      .where(eq(bottleObservations.id, observation.id));
    const [updatedDecision] = await db
      .select()
      .from(incomingBottleDecisionLogs)
      .where(eq(incomingBottleDecisionLogs.id, decisionLog.id));
    const [updatedTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tasting.id));
    const [updatedSourcePrice, updatedExactPrice, updatedNullPrice] = await db
      .select()
      .from(storePrices)
      .where(
        inArray(storePrices.id, [sourcePrice.id, exactPrice.id, nullPrice.id]),
      )
      .orderBy(asc(storePrices.id));
    for (const row of [
      updatedReview,
      updatedObservation,
      updatedDecision,
      updatedTasting,
      updatedSourcePrice,
    ]) {
      expect(row.targetId).toBe(destinationGeneric.id);
    }
    expect(updatedExactPrice.targetId).toBe(sourceExact.id);
    expect(updatedNullPrice.targetId).toBeNull();

    const [updatedProposal] = await db
      .select()
      .from(storePriceMatchProposals)
      .where(eq(storePriceMatchProposals.id, proposal.id));
    const [updatedAttempt] = await db
      .select()
      .from(storePriceMatchAttempts)
      .where(eq(storePriceMatchAttempts.id, attempt.id));
    expect(updatedProposal).toMatchObject({
      currentTargetId: destinationGeneric.id,
      suggestedTargetId: sourceExact.id,
      parentBottleId: source.first.bottle.id,
    });
    expect(updatedAttempt).toMatchObject({
      currentTargetId: sourceExact.id,
      suggestedTargetId: destinationGeneric.id,
      parentBottleId: source.first.bottle.id,
    });

    const duplicateCollectionRows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, duplicateCollection.id));
    expect(duplicateCollectionRows).toEqual([
      expect.objectContaining({
        bottleId: destination.first.bottle.id,
        targetId: destinationGeneric.id,
        imageUrl: "/source-image.jpg",
        status: "open",
      }),
    ]);
    expect(
      await db
        .select({
          id: collections.id,
          totalBottles: collections.totalBottles,
        })
        .from(collections)
        .where(
          inArray(collections.id, [
            duplicateCollection.id,
            sourceOnlyCollection.id,
          ]),
        )
        .orderBy(asc(collections.id)),
    ).toEqual(
      [
        { id: duplicateCollection.id, totalBottles: 1 },
        { id: sourceOnlyCollection.id, totalBottles: 1 },
      ].sort((left, right) => left.id - right.id),
    );
    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, sourceOnlyCollection.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: source.first.bottle.id,
        targetId: destinationGeneric.id,
        imageUrl: "/source-only.jpg",
        status: "empty",
      }),
    ]);
    expect(
      await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, duplicateFlight.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: destination.first.bottle.id,
        targetId: destinationGeneric.id,
      }),
    ]);
    expect(
      await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, sourceOnlyFlight.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: source.first.bottle.id,
        targetId: destinationGeneric.id,
      }),
    ]);
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.name, "Retargeted Stable Merge Alias")),
    ).toEqual([
      expect.objectContaining({
        bottleId: null,
        targetId: destinationGeneric.id,
      }),
    ]);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "OnBottleAliasChange",
      { name: "Retargeted Stable Merge Alias" },
    );
    const [sourceGroupAudit] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle_group"),
          eq(changes.objectId, source.first.group.id),
          eq(changes.type, "delete"),
        ),
      );
    expect(sourceGroupAudit.data.stableAliasesBefore).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Retargeted Stable Merge Alias",
          bottleId: null,
          releaseId: null,
          targetId: sourceGeneric.id,
          assignmentSource: "human_approved",
          assignedByActorId: actor.id,
        }),
      ]),
    );
    const genericPreimages = sourceGroupAudit.data.genericConsumerPreimages;
    expect(genericPreimages.directTargets).toEqual({
      tastings: [{ id: tasting.id, targetId: sourceGeneric.id }],
      reviews: [{ id: review.id, targetId: sourceGeneric.id }],
      storePrices: [{ id: sourcePrice.id, targetId: sourceGeneric.id }],
      bottleObservations: [{ id: observation.id, targetId: sourceGeneric.id }],
      incomingBottleDecisionLogs: [
        { id: decisionLog.id, targetId: sourceGeneric.id },
      ],
    });
    expect(genericPreimages.targetPairs).toEqual({
      storePriceMatchProposals: [
        {
          id: proposal.id,
          currentTargetId: sourceGeneric.id,
          suggestedTargetId: sourceExact.id,
          updatedAt: proposal.updatedAt.toISOString(),
        },
      ],
      storePriceMatchAttempts: [
        {
          id: attempt.id,
          currentTargetId: sourceExact.id,
          suggestedTargetId: sourceGeneric.id,
          updatedAt: attempt.updatedAt.toISOString(),
        },
      ],
    });
    expect(genericPreimages.collections.sourceRows).toHaveLength(2);
    expect(genericPreimages.collections.sourceRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionId: duplicateCollection.id,
          bottleId: source.first.bottle.id,
          targetId: sourceGeneric.id,
          imageUrl: "/source-image.jpg",
          status: "sealed",
        }),
        expect.objectContaining({
          collectionId: sourceOnlyCollection.id,
          bottleId: source.first.bottle.id,
          targetId: sourceGeneric.id,
          imageUrl: "/source-only.jpg",
          status: "empty",
        }),
      ]),
    );
    expect(genericPreimages.collections.destinationRowsBefore).toEqual([
      expect.objectContaining({
        collectionId: duplicateCollection.id,
        bottleId: destination.first.bottle.id,
        targetId: destinationGeneric.id,
        imageUrl: "   ",
        status: "open",
      }),
    ]);
    expect(genericPreimages.flights).toHaveLength(2);
    expect(genericPreimages.flights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flightId: duplicateFlight.id,
          bottleId: source.first.bottle.id,
          targetId: sourceGeneric.id,
        }),
        expect.objectContaining({
          flightId: sourceOnlyFlight.id,
          bottleId: source.first.bottle.id,
          targetId: sourceGeneric.id,
        }),
      ]),
    );
    const [destinationAfter] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, destination.first.group.id));
    expect(destinationAfter).toMatchObject({
      totalBottles: 2,
      totalTastings: 2,
    });
  });

  test("rejects tasting and identity collisions with a full rollback", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const sourceBrand = await fixtures.Entity({
      name: "Rollback Source Brand",
    });
    const destinationBrand = await fixtures.Entity({
      name: "Rollback Destination Brand",
    });
    const source = await createGroup({
      user: mod,
      stable: {
        name: "Rollback Source",
        brand: sourceBrand.id,
        distillers: [],
      },
      exacts: [{ edition: "Unique Source Batch", abv: 51 }],
    });
    const destination = await createGroup({
      user: mod,
      stable: {
        name: "Rollback Destination",
        brand: destinationBrand.id,
        distillers: [],
      },
      exacts: [{ edition: "Unique Destination Batch", abv: 41 }],
    });
    const sourceGeneric = (await loadTargets(source.first.group.id)).find(
      ({ bottleId }) => bottleId === null,
    )!;
    const destinationGeneric = (
      await loadTargets(destination.first.group.id)
    ).find(({ bottleId }) => bottleId === null)!;
    const collisionTime = new Date("2026-02-03T04:05:06.000Z");
    await fixtures.Tasting({
      bottleId: source.first.bottle.id,
      targetId: sourceGeneric.id,
      createdById: mod.id,
      createdAt: collisionTime,
    });
    await fixtures.Tasting({
      bottleId: destination.first.bottle.id,
      targetId: destinationGeneric.id,
      createdById: mod.id,
      createdAt: collisionTime,
    });
    resetQueueMock();

    const error = await waitError(
      mergeBottleGroups({
        sourceGroupId: source.first.group.id,
        destinationGroupId: destination.first.group.id,
        context: contextFor(mod),
      }),
      BottleGroupMergeConflictError,
    );
    expect(error).toMatchObject({ code: "consumer_conflict" });
    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, source.first.group.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(bottleGroupTombstones)
        .where(eq(bottleGroupTombstones.groupId, source.first.group.id)),
    ).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();

    const identitySource = await createGroup({
      user: mod,
      stable: {
        name: "Identity Source",
        brand: sourceBrand.id,
        distillers: [],
      },
      exacts: [{ edition: "Collision Batch", abv: 47 }],
    });
    const identityDestination = await createGroup({
      user: mod,
      stable: {
        name: "Identity Destination",
        brand: destinationBrand.id,
        distillers: [],
      },
      exacts: [{ edition: "Collision Batch", abv: 47 }],
    });
    resetQueueMock();
    const identityError = await waitError(
      mergeBottleGroups({
        sourceGroupId: identitySource.first.group.id,
        destinationGroupId: identityDestination.first.group.id,
        context: contextFor(mod),
      }),
      BottleGroupMergeConflictError,
    );
    expect(identityError).toMatchObject({
      code: "identity_conflict",
      conflictingBottleId: identityDestination.first.bottle.id,
    });
    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, identitySource.first.group.id)),
    ).toHaveLength(1);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("updates tombstone chains and makes an identical retry inert", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Merge Chain Brand" });
    const createChainGroup = (name: string, edition: string) =>
      createGroup({
        user: mod,
        stable: { name, brand: brand.id, distillers: [] },
        exacts: [{ edition, abv: 45 }],
      });
    const first = await createChainGroup("Chain First", "First Batch");
    const second = await createChainGroup("Chain Second", "Second Batch");
    const third = await createChainGroup("Chain Third", "Third Batch");

    await mergeBottleGroups({
      sourceGroupId: first.first.group.id,
      destinationGroupId: second.first.group.id,
      context: contextFor(mod),
    });
    const retiredParentId = 9_000_003;
    await db.insert(bottleTombstones).values({
      bottleId: retiredParentId,
      newGroupId: second.first.group.id,
    });
    const retiredParentTombstoneBefore =
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, retiredParentId),
      });
    const [firstTombstoneBefore] = await db
      .select()
      .from(bottleGroupTombstones)
      .where(eq(bottleGroupTombstones.groupId, first.first.group.id));
    await mergeBottleGroups({
      sourceGroupId: second.first.group.id,
      destinationGroupId: third.first.group.id,
      context: contextFor(mod),
    });
    const [secondMergeSourceAudit] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle_group"),
          eq(changes.objectId, second.first.group.id),
          eq(changes.type, "delete"),
        ),
      );
    expect(secondMergeSourceAudit.data.predecessorTombstonesBefore).toEqual([
      {
        groupId: first.first.group.id,
        newGroupId: second.first.group.id,
        createdByActorId: firstTombstoneBefore.createdByActorId,
        createdAt: firstTombstoneBefore.createdAt.toISOString(),
      },
    ]);
    expect(
      secondMergeSourceAudit.data.predecessorBottleTombstonesBefore,
    ).toEqual([retiredParentTombstoneBefore]);
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, retiredParentId),
      }),
    ).toEqual({
      bottleId: retiredParentId,
      newBottleId: null,
      newGroupId: third.first.group.id,
    });
    expect(
      await db
        .select()
        .from(bottleGroupTombstones)
        .where(
          inArray(bottleGroupTombstones.groupId, [
            first.first.group.id,
            second.first.group.id,
          ]),
        )
        .orderBy(asc(bottleGroupTombstones.groupId)),
    ).toEqual([
      expect.objectContaining({
        groupId: first.first.group.id,
        newGroupId: third.first.group.id,
      }),
      expect.objectContaining({
        groupId: second.first.group.id,
        newGroupId: third.first.group.id,
      }),
    ]);

    resetQueueMock();
    const auditCountBefore = (await db.select({ id: changes.id }).from(changes))
      .length;
    await expect(
      mergeBottleGroups({
        sourceGroupId: second.first.group.id,
        destinationGroupId: third.first.group.id,
        context: contextFor(mod),
      }),
    ).resolves.toEqual({
      sourceGroupId: second.first.group.id,
      destinationGroupId: third.first.group.id,
      changed: false,
      movedBottleIds: [],
    });
    expect(await db.select({ id: changes.id }).from(changes)).toHaveLength(
      auditCountBefore,
    );
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();

    expect(
      await waitError(
        mergeBottleGroups({
          sourceGroupId: first.first.group.id,
          destinationGroupId: second.first.group.id,
          context: contextFor(mod),
        }),
      ),
    ).toMatchObject({ code: "retired_to_other_destination" });
  });

  test("rejects an invalid source catalog graph", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Invalid Graph Brand" });
    const source = await createGroup({
      user: mod,
      stable: { name: "Invalid Source", brand: brand.id, distillers: [] },
      exacts: [{ edition: "Invalid Batch", abv: 44 }],
    });
    const destination = await createGroup({
      user: mod,
      stable: { name: "Valid Destination", brand: brand.id, distillers: [] },
      exacts: [{ edition: "Valid Batch", abv: 43 }],
    });
    const exactTarget = (await loadTargets(source.first.group.id)).find(
      ({ bottleId }) => bottleId === source.first.bottle.id,
    )!;
    await db
      .update(bottleAliases)
      .set({ targetId: null })
      .where(eq(bottleAliases.targetId, exactTarget.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.bottleId, source.first.bottle.id));

    const error = await waitError(
      mergeBottleGroups({
        sourceGroupId: source.first.group.id,
        destinationGroupId: destination.first.group.id,
        context: contextFor(mod),
      }),
      BottleGroupMergeGraphError,
    );
    expect(error).toMatchObject({ code: "invalid_catalog_graph" });
  });
});
