import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleObservations,
  bottleReleases,
  bottles,
  bottlesToDistillers,
  bottleTags,
  bottleTombstones,
  changes,
  collectionBottles,
  flightBottles,
  legacyReleaseRepairReviews,
  reviews,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import {
  getLegacyReleaseRepairBottleFingerprint,
  getLegacyReleaseRepairParentCandidatesFingerprint,
  LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
} from "@peated/server/lib/legacyReleaseRepairReviewState";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);

function createClassifierCreateBottleResult() {
  return {
    status: "classified" as const,
    decision: {
      action: "create_bottle" as const,
      confidence: 92,
      rationale: "Local candidates do not show a reusable parent bottle.",
      candidateBottleIds: [],
      identityScope: "product" as const,
      observation: null,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: {
        name: "Classifier Parent",
        series: null,
        category: null,
        edition: null,
        statedAge: null,
        caskStrength: null,
        singleCask: null,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Classifier Brand",
        },
        distillers: [],
        bottler: null,
      },
      proposedRelease: null,
    },
    artifacts: {
      extractedIdentity: null,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
    },
  };
}

function getLegacyBottleReviewFingerprintInput(legacyBottle: {
  abv?: null | number;
  category?: null | string;
  caskFill?: null | string;
  caskSize?: null | string;
  caskStrength?: null | boolean;
  caskType?: null | string;
  edition?: null | string;
  fullName: string;
  releaseYear?: null | number;
  singleCask?: null | boolean;
  statedAge?: null | number;
  vintageYear?: null | number;
}) {
  return {
    abv: legacyBottle.abv ?? null,
    category: legacyBottle.category ?? null,
    caskFill: legacyBottle.caskFill ?? null,
    caskSize: legacyBottle.caskSize ?? null,
    caskStrength: legacyBottle.caskStrength ?? null,
    caskType: legacyBottle.caskType ?? null,
    edition: legacyBottle.edition ?? null,
    fullName: legacyBottle.fullName,
    releaseYear: legacyBottle.releaseYear ?? null,
    singleCask: legacyBottle.singleCask ?? null,
    statedAge: legacyBottle.statedAge ?? null,
    vintageYear: legacyBottle.vintageYear ?? null,
  };
}

function getParentBottleReviewFingerprintInput(parentBottle: {
  id: number;
  abv?: null | number;
  category?: null | string;
  caskFill?: null | string;
  caskSize?: null | string;
  caskStrength?: null | boolean;
  caskType?: null | string;
  edition?: null | string;
  fullName: string;
  releaseYear?: null | number;
  singleCask?: null | boolean;
  statedAge?: null | number;
  totalTastings?: null | number;
  vintageYear?: null | number;
}) {
  return {
    id: parentBottle.id,
    abv: parentBottle.abv ?? null,
    category: parentBottle.category ?? null,
    caskFill: parentBottle.caskFill ?? null,
    caskSize: parentBottle.caskSize ?? null,
    caskStrength: parentBottle.caskStrength ?? null,
    caskType: parentBottle.caskType ?? null,
    edition: parentBottle.edition ?? null,
    fullName: parentBottle.fullName,
    releaseYear: parentBottle.releaseYear ?? null,
    singleCask: parentBottle.singleCask ?? null,
    statedAge: parentBottle.statedAge ?? null,
    totalTastings: parentBottle.totalTastings ?? null,
    vintageYear: parentBottle.vintageYear ?? null,
  };
}

describe("POST /bottles/:bottle/apply-release-repair", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      createClassifierCreateBottleResult(),
    );
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.applyReleaseRepair(
        {
          bottle: 1,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("moves a legacy release-like bottle under the exact parent bottle", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const distiller = await fixtures.Entity({ name: "Speyside Distillery" });
    const mod = await fixtures.User({ mod: true });

    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 50,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
      totalTastings: 12,
      description: "Legacy release description",
      imageUrl: "/images/legacy-abunadh.jpg",
      createdById: mod.id,
    });

    await db.insert(bottlesToDistillers).values({
      bottleId: legacyBottle.id,
      distillerId: distiller.id,
    });

    await db.insert(bottleAliases).values({
      bottleId: legacyBottle.id,
      name: "A'bunadh",
    });

    await db.insert(bottleTags).values({
      bottleId: parent.id,
      tag: "sherry",
      count: 2,
    });
    await db.insert(bottleTags).values({
      bottleId: legacyBottle.id,
      tag: "sherry",
      count: 3,
    });
    await db.insert(bottleFlavorProfiles).values({
      bottleId: parent.id,
      flavorProfile: "peated",
      count: 1,
    });
    await db.insert(bottleFlavorProfiles).values({
      bottleId: legacyBottle.id,
      flavorProfile: "peated",
      count: 4,
    });

    const releaseSpecificTasting = await fixtures.Tasting({
      bottleId: legacyBottle.id,
      rating: 4,
    });

    const collection = await fixtures.Collection();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: legacyBottle.id,
    });

    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: legacyBottle.id,
    });

    const externalSite = await fixtures.ExternalSite();
    await db.insert(bottleObservations).values({
      bottleId: legacyBottle.id,
      sourceType: "store_price",
      sourceKey: "legacy-abunadh-price",
      sourceName: legacyBottle.fullName,
      externalSiteId: externalSite.id,
      createdById: mod.id,
    });

    const genericReview = await fixtures.Review({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      issue: "Spring 2026",
      name: parent.fullName,
    });
    const releaseReview = await fixtures.Review({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      issue: "Fall 2026",
      name: legacyBottle.fullName,
    });

    const genericPrice = await fixtures.StorePrice({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      name: parent.fullName,
      volume: 700,
    });
    const releasePrice = await fixtures.StorePrice({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      name: legacyBottle.fullName,
      volume: 750,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: releasePrice.id,
        status: "approved",
        proposalType: "match_existing",
        currentBottleId: legacyBottle.id,
        suggestedBottleId: legacyBottle.id,
        parentBottleId: legacyBottle.id,
        reviewedById: mod.id,
        reviewedAt: new Date(),
      })
      .returning();

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      legacyBottleId: legacyBottle.id,
      parentBottleId: parent.id,
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parent.id,
      edition: "Batch 32",
      description: "Legacy release description",
      imageUrl: "/images/legacy-abunadh.jpg",
    });

    const [deletedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, legacyBottle.id));
    expect(deletedBottle).toBeUndefined();

    const [tombstone] = await db
      .select()
      .from(bottleTombstones)
      .where(eq(bottleTombstones.bottleId, legacyBottle.id));
    expect(tombstone.newBottleId).toBe(parent.id);

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, releaseSpecificTasting.id));
    expect(tasting).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [collectionBottle] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    expect(collectionBottle).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [flightBottle] = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(flightBottle).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [observation] = await db
      .select()
      .from(bottleObservations)
      .where(eq(bottleObservations.sourceKey, "legacy-abunadh-price"));
    expect(observation).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [updatedGenericReview, updatedReleaseReview] = await db
      .select()
      .from(reviews)
      .where(inArray(reviews.id, [genericReview.id, releaseReview.id]))
      .orderBy(reviews.id);
    expect(updatedGenericReview).toMatchObject({
      id: genericReview.id,
      bottleId: parent.id,
      releaseId: null,
    });
    expect(updatedReleaseReview).toMatchObject({
      id: releaseReview.id,
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [updatedGenericPrice, updatedReleasePrice] = await db
      .select()
      .from(storePrices)
      .where(inArray(storePrices.id, [genericPrice.id, releasePrice.id]))
      .orderBy(storePrices.id);
    expect(updatedGenericPrice).toMatchObject({
      id: genericPrice.id,
      bottleId: parent.id,
      releaseId: null,
    });
    expect(updatedReleasePrice).toMatchObject({
      id: releasePrice.id,
      bottleId: parent.id,
      releaseId: release.id,
    });

    const legacyCanonicalAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, legacyBottle.fullName),
    });
    const genericAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "A'bunadh"),
    });
    expect(legacyCanonicalAlias).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });
    expect(genericAlias).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
    });

    const [tag] = await db
      .select()
      .from(bottleTags)
      .where(
        and(eq(bottleTags.bottleId, parent.id), eq(bottleTags.tag, "sherry")),
      );
    expect(tag.count).toBe(5);

    const [flavorProfile] = await db
      .select()
      .from(bottleFlavorProfiles)
      .where(
        and(
          eq(bottleFlavorProfiles.bottleId, parent.id),
          eq(bottleFlavorProfiles.flavorProfile, "peated"),
        ),
      );
    expect(flavorProfile.count).toBe(5);

    const parentDistillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, parent.id));
    expect(parentDistillers.map((row) => row.distillerId)).toContain(
      distiller.id,
    );

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    expect(updatedProposal).toMatchObject({
      currentBottleId: null,
      currentReleaseId: null,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: null,
      status: "pending_review",
      reviewedById: null,
      reviewedAt: null,
    });

    const [deleteChange] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle"),
          eq(changes.objectId, legacyBottle.id),
          eq(changes.type, "delete"),
        ),
      );
    expect(deleteChange).toBeDefined();
    expect(deleteChange.type).toBe("delete");
  });

  test("creates a reusable parent bottle when no exact parent bottle exists", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 1,
    });
    const distiller = await fixtures.Entity({ name: "Warehouse Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
      flavorProfile: "spicy_sweet",
    });
    await db.insert(bottlesToDistillers).values({
      bottleId: legacyBottle.id,
      distillerId: distiller.id,
    });
    await db.insert(bottleAliases).values({
      bottleId: legacyBottle.id,
      name: "Festival Distillery Warehouse Session",
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    const [parentBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.parentBottleId));
    expect(parentBottle).toMatchObject({
      id: result.parentBottleId,
      brandId: brand.id,
      name: "Warehouse Session",
      fullName: "Festival Distillery Warehouse Session",
      statedAge: 12,
      category: "single_malt",
      flavorProfile: "spicy_sweet",
      edition: null,
      releaseYear: null,
      numReleases: 1,
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      edition: "Batch 2",
      statedAge: 12,
    });

    const genericAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, parentBottle.fullName),
    });
    expect(genericAlias).toMatchObject({
      bottleId: parentBottle.id,
      releaseId: null,
    });

    const [deletedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, legacyBottle.id));
    expect(deletedBottle).toBeUndefined();

    const parentDistillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, parentBottle.id));
    expect(parentDistillers.map((row) => row.distillerId)).toContain(
      distiller.id,
    );

    const refreshedBrand = await db.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, brand.id),
    });
    expect(refreshedBrand?.totalBottles).toBe(1);
  });

  test("reuses a classifier-reviewed existing parent instead of creating a heuristic duplicate", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 2,
    });
    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Sessions",
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValueOnce({
      status: "classified",
      decision: {
        action: "match",
        confidence: 95,
        rationale: "The existing parent bottle is the same product family.",
        candidateBottleIds: [parentBottle.id],
        identityScope: "product",
        observation: null,
        matchedBottleId: parentBottle.id,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
      },
    });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(parentBottle.id);

    const brandBottles = await db
      .select({
        id: bottles.id,
      })
      .from(bottles)
      .where(eq(bottles.brandId, brand.id));
    expect(brandBottles.map((row) => row.id).sort((a, b) => a - b)).toEqual([
      parentBottle.id,
    ]);
  });

  test("reuses a matching persisted reviewed parent without re-running live classifier review", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 2,
    });
    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Sessions",
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    await db.insert(legacyReleaseRepairReviews).values({
      legacyBottleId: legacyBottle.id,
      legacyBottleFingerprint: getLegacyReleaseRepairBottleFingerprint(
        getLegacyBottleReviewFingerprintInput(legacyBottle),
      ),
      parentCandidatesFingerprint:
        getLegacyReleaseRepairParentCandidatesFingerprint([
          getParentBottleReviewFingerprintInput(parentBottle),
        ]),
      proposedParentFullName: "Festival Distillery Warehouse Session",
      releaseEdition: "Batch 2",
      releaseYear: null,
      resolution: "reuse_existing_parent",
      reviewedParentBottleId: parentBottle.id,
      reviewVersion: LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
      reviewedAt: new Date(),
    });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(parentBottle.id);
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("blocks apply-time repair from a matching persisted blocked review without re-running live classifier review", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 1,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    await db.insert(legacyReleaseRepairReviews).values({
      legacyBottleId: legacyBottle.id,
      legacyBottleFingerprint: getLegacyReleaseRepairBottleFingerprint(
        getLegacyBottleReviewFingerprintInput(legacyBottle),
      ),
      parentCandidatesFingerprint:
        getLegacyReleaseRepairParentCandidatesFingerprint([]),
      proposedParentFullName: "Festival Distillery Warehouse Session",
      releaseEdition: "Batch 2",
      releaseYear: null,
      resolution: "blocked",
      reviewedParentBottleId: null,
      blockedReason: "Stored classifier review blocked this repair.",
      reviewVersion: LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
      reviewedAt: new Date(),
    });

    const err = await waitError(
      routerClient.bottles.applyReleaseRepair(
        {
          bottle: legacyBottle.id,
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Stored classifier review blocked this repair.]`,
    );
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("ignores stale persisted reviews when the derived release identity changes and falls back to live classifier validation", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 2,
    });
    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Sessions",
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    await db.insert(legacyReleaseRepairReviews).values({
      legacyBottleId: legacyBottle.id,
      legacyBottleFingerprint: getLegacyReleaseRepairBottleFingerprint(
        getLegacyBottleReviewFingerprintInput(legacyBottle),
      ),
      parentCandidatesFingerprint:
        getLegacyReleaseRepairParentCandidatesFingerprint([
          getParentBottleReviewFingerprintInput(parentBottle),
        ]),
      proposedParentFullName: "Festival Distillery Warehouse Session",
      releaseEdition: "Batch 3",
      releaseYear: null,
      resolution: "blocked",
      reviewedParentBottleId: null,
      blockedReason: "stale review",
      reviewVersion: LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
      reviewedAt: new Date(),
    });

    classifyBottleReferenceMock.mockResolvedValueOnce({
      status: "classified",
      decision: {
        action: "match",
        confidence: 95,
        rationale: "The existing parent bottle is the same product family.",
        candidateBottleIds: [parentBottle.id],
        identityScope: "product",
        observation: null,
        matchedBottleId: parentBottle.id,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
      },
    });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(parentBottle.id);
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
  });

  test("ignores persisted reviews when classifier-relevant legacy bottle traits change and falls back to live classifier validation", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 2,
    });
    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Sessions",
      category: "single_malt",
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    await db.insert(legacyReleaseRepairReviews).values({
      legacyBottleId: legacyBottle.id,
      legacyBottleFingerprint: getLegacyReleaseRepairBottleFingerprint(
        getLegacyBottleReviewFingerprintInput(legacyBottle),
      ),
      parentCandidatesFingerprint:
        getLegacyReleaseRepairParentCandidatesFingerprint([
          getParentBottleReviewFingerprintInput(parentBottle),
        ]),
      proposedParentFullName: "Festival Distillery Warehouse Session",
      releaseEdition: "Batch 2",
      releaseYear: null,
      resolution: "blocked",
      reviewedParentBottleId: null,
      blockedReason: "stale review",
      reviewVersion: LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
      reviewedAt: new Date(),
    });

    await db
      .update(bottles)
      .set({ category: "bourbon" })
      .where(eq(bottles.id, legacyBottle.id));

    classifyBottleReferenceMock.mockResolvedValueOnce({
      status: "classified",
      decision: {
        action: "match",
        confidence: 95,
        rationale: "The existing parent bottle is the same product family.",
        candidateBottleIds: [parentBottle.id],
        identityScope: "product",
        observation: null,
        matchedBottleId: parentBottle.id,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
      },
    });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(parentBottle.id);
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
  });

  test("ignores persisted reviews when the reviewed parent candidate set changes and falls back to live classifier validation", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 2,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    await db.insert(legacyReleaseRepairReviews).values({
      legacyBottleId: legacyBottle.id,
      legacyBottleFingerprint: getLegacyReleaseRepairBottleFingerprint(
        getLegacyBottleReviewFingerprintInput(legacyBottle),
      ),
      parentCandidatesFingerprint:
        getLegacyReleaseRepairParentCandidatesFingerprint([]),
      proposedParentFullName: "Festival Distillery Warehouse Session",
      releaseEdition: "Batch 2",
      releaseYear: null,
      resolution: "blocked",
      reviewedParentBottleId: null,
      blockedReason: "stale review",
      reviewVersion: LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
      reviewedAt: new Date(),
    });

    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Sessions",
      category: "single_malt",
      totalTastings: 80,
    });

    classifyBottleReferenceMock.mockResolvedValueOnce({
      status: "classified",
      decision: {
        action: "match",
        confidence: 95,
        rationale: "The existing parent bottle is the same product family.",
        candidateBottleIds: [parentBottle.id],
        identityScope: "product",
        observation: null,
        matchedBottleId: parentBottle.id,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
      },
    });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(parentBottle.id);
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
  });

  test("blocks heuristic create-parent repairs when classifier cannot verify the parent decision", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 1,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValueOnce({
      status: "classified",
      decision: {
        action: "no_match",
        confidence: 41,
        rationale: "Identity is not strong enough to create or reuse a parent.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
      },
    });

    const err = await waitError(
      routerClient.bottles.applyReleaseRepair(
        {
          bottle: legacyBottle.id,
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Classifier could not verify whether this repair should reuse an existing parent bottle or create a new one.]`,
    );

    const brandBottles = await db
      .select({
        id: bottles.id,
      })
      .from(bottles)
      .where(eq(bottles.brandId, brand.id));
    expect(brandBottles.map((row) => row.id)).toEqual([legacyBottle.id]);
  });

  test("blocks classifier redirects to parent bottles outside the reviewed repair parent set", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 1,
    });
    const unrelatedBrand = await fixtures.Entity({
      name: "Other Distillery",
      totalBottles: 1,
    });
    const unrelatedBottle = await fixtures.Bottle({
      brandId: unrelatedBrand.id,
      name: "Warehouse Session",
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValueOnce({
      status: "classified",
      decision: {
        action: "match",
        confidence: 88,
        rationale: "Classifier picked an unrelated bottle.",
        candidateBottleIds: [unrelatedBottle.id],
        identityScope: "product",
        observation: null,
        matchedBottleId: unrelatedBottle.id,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
      },
    });

    const err = await waitError(
      routerClient.bottles.applyReleaseRepair(
        {
          bottle: legacyBottle.id,
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Classifier pointed at a bottle outside the reviewed repair parent set.]`,
    );
  });

  test("creates a reusable parent bottle for branded generic-name releases", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Lagavulin",
      totalBottles: 1,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Distillers Edition",
      edition: "2011 Release",
      releaseYear: 2011,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    const [parentBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.parentBottleId));
    expect(parentBottle).toMatchObject({
      id: result.parentBottleId,
      brandId: brand.id,
      name: "Distillers Edition",
      fullName: "Lagavulin Distillers Edition",
      releaseYear: null,
      edition: null,
      numReleases: 1,
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      edition: "2011 Release",
      releaseYear: 2011,
    });
  });

  test("reuses an existing exactish generic parent instead of creating a duplicate parent bottle", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Elijah Craig",
      totalBottles: 2,
    });
    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof",
      category: "bourbon",
      totalTastings: 120,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof Kentucky Straight Bourbon (Batch C923)",
      statedAge: 12,
      category: "bourbon",
      totalTastings: 9,
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(parentBottle.id);

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      edition: "Batch C923",
      statedAge: 12,
    });

    const existingParents = await db
      .select({
        id: bottles.id,
      })
      .from(bottles)
      .where(eq(bottles.brandId, brand.id));
    expect(existingParents.map((row) => row.id)).toEqual([parentBottle.id]);
  });

  test("creates a new parent when the only generic variant conflicts on category markers", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Rock Town",
      totalBottles: 2,
    });
    const bourbonParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Bourbon",
      category: null,
      totalTastings: 120,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Rye (Batch 1)",
      category: "rye",
      totalTastings: 9,
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).not.toBe(bourbonParent.id);

    const [parentBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.parentBottleId));
    expect(parentBottle).toMatchObject({
      id: result.parentBottleId,
      brandId: brand.id,
      name: "Arkansas Rye",
      fullName: "Rock Town Arkansas Rye",
      category: "rye",
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      edition: "Batch 1",
    });
  });

  test("reuses the existing parent when the legacy bottle category is dirty", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Rock Town",
      totalBottles: 2,
    });
    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Rye",
      category: "rye",
      totalTastings: 120,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Rye (Batch 1)",
      category: "bourbon",
      totalTastings: 9,
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(parentBottle.id);

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      edition: "Batch 1",
    });

    const refreshedParent = await db.query.bottles.findFirst({
      where: eq(bottles.id, parentBottle.id),
    });
    expect(refreshedParent).toMatchObject({
      id: parentBottle.id,
      name: "Arkansas Rye",
      fullName: "Rock Town Arkansas Rye",
      category: "rye",
      numReleases: 1,
    });
  });

  test("prefers the longest brand prefix when deriving a created parent name", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "MAKER'S MARK",
      shortName: "MAKER'S",
      totalBottles: 1,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "46",
      edition: "Batch 1",
      category: "bourbon",
    });
    await db
      .update(bottles)
      .set({
        fullName: "Maker's Mark 46 - Batch 1",
      })
      .where(eq(bottles.id, legacyBottle.id));
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    const [parentBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.parentBottleId));
    expect(parentBottle).toMatchObject({
      id: result.parentBottleId,
      brandId: brand.id,
      name: "46",
      fullName: "Maker's Mark 46",
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      name: "46 - Batch 1",
      fullName: "Maker's Mark 46 - Batch 1",
    });
  });

  test("prefers a clean exact-name parent when a dirtier duplicate also exists", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const dirtyParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 100,
    });
    await db
      .update(bottles)
      .set({ edition: "Batch 31" })
      .where(eq(bottles.id, dirtyParent.id));
    const cleanParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh Parent Placeholder",
      totalTastings: 50,
    });
    await db
      .update(bottles)
      .set({
        name: "A'bunadh",
        fullName: dirtyParent.fullName,
      })
      .where(eq(bottles.id, cleanParent.id));
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(cleanParent.id);

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release.bottleId).toBe(cleanParent.id);
  });

  test("reuses an existing release without duplicating collection or flight rows", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 80,
    });
    const existingRelease = await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "Batch 32",
      description: null,
      imageUrl: "https://example.com/existing-release.png",
      tastingNotes: null,
      createdById: mod.id,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
      description: "Recovered legacy description",
      imageUrl: "/images/legacy-abunadh.png",
      tastingNotes: {
        nose: "Raisin",
        palate: "Chocolate",
        finish: "Spice",
      },
      createdById: mod.id,
    });

    const collection = await fixtures.Collection();
    await db.insert(collectionBottles).values([
      {
        collectionId: collection.id,
        bottleId: parent.id,
        releaseId: existingRelease.id,
      },
      {
        collectionId: collection.id,
        bottleId: legacyBottle.id,
      },
    ]);

    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values([
      {
        flightId: flight.id,
        bottleId: parent.id,
        releaseId: existingRelease.id,
      },
      {
        flightId: flight.id,
        bottleId: legacyBottle.id,
      },
    ]);

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.releaseId).toBe(existingRelease.id);

    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, existingRelease.id));
    expect(updatedRelease).toMatchObject({
      description: "Recovered legacy description",
      imageUrl: "https://example.com/existing-release.png",
      tastingNotes: {
        nose: "Raisin",
        palate: "Chocolate",
        finish: "Spice",
      },
    });

    const collectionRows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    expect(collectionRows).toHaveLength(1);
    expect(collectionRows[0]).toMatchObject({
      collectionId: collection.id,
      bottleId: parent.id,
      releaseId: existingRelease.id,
    });

    const flightRows = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(flightRows).toHaveLength(1);
    expect(flightRows[0]).toMatchObject({
      flightId: flight.id,
      bottleId: parent.id,
      releaseId: existingRelease.id,
    });
  });

  test("rejects repair when the exact-name parent is still release-specific", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const dirtyParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
    });
    await db
      .update(bottles)
      .set({ edition: "Batch 31" })
      .where(eq(bottles.id, dirtyParent.id));
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
    });
    const mod = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.applyReleaseRepair(
        {
          bottle: legacyBottle.id,
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Exact parent bottle still contains bottle-level release traits.]`,
    );
  });
});
