import { db } from "@peated/server/db";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { refreshLegacyReleaseRepairReview } from "@peated/server/lib/legacyReleaseRepairReviews";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
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

describe("GET /bottles/release-repair-candidates", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      createClassifierCreateBottleResult(),
    );
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.releaseRepairCandidates({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists legacy batch bottles under an exact parent bottle", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Glenmorangie" });
    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "The Cadboll Estate 15-year-old",
      statedAge: 15,
      totalTastings: 100,
    });
    const batch2 = await fixtures.Bottle({
      brandId: brand.id,
      name: "The Cadboll Estate 15-year-old (Batch 2)",
      statedAge: 15,
      totalTastings: 20,
    });
    const batch4 = await fixtures.Bottle({
      brandId: brand.id,
      name: "The Cadboll Estate 15-year-old (Batch 4)",
      statedAge: 15,
      totalTastings: 10,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {},
      { context: { user } },
    );

    expect(result.results).toHaveLength(2);

    const batch4Candidate = result.results.find(
      (candidate) => candidate.legacyBottle.id === batch4.id,
    );
    expect(batch4Candidate).toMatchObject({
      hasExactParent: true,
      repairMode: "existing_parent",
      legacyBottle: {
        id: batch4.id,
        fullName: batch4.fullName,
      },
      proposedParent: {
        id: parent.id,
        fullName: parent.fullName,
      },
      releaseIdentity: {
        edition: "Batch 4",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
      siblingLegacyBottles: [{ id: batch2.id, fullName: batch2.fullName }],
    });
  });

  test("lists sibling legacy bottles even when the parent bottle does not exist", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Festival Distillery" });
    const batch1 = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const batch2 = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      totalTastings: 4,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(result.results).toHaveLength(2);

    const batch1Candidate = result.results.find(
      (candidate) => candidate.legacyBottle.id === batch1.id,
    );
    expect(batch1Candidate).toMatchObject({
      hasExactParent: false,
      repairMode: "create_parent",
      proposedParent: {
        id: null,
        fullName: "Festival Distillery Warehouse Session",
        totalTastings: null,
      },
      releaseIdentity: {
        edition: "Batch 1",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
      siblingLegacyBottles: [{ id: batch2.id, fullName: batch2.fullName }],
    });
  });

  test("reuses an existing parent bottle for exactish generic-name variants", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Elijah Craig" });
    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof",
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof Kentucky Straight Bourbon (Batch C923)",
      totalTastings: 8,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Elijah Craig Barrel Proof",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      hasExactParent: false,
      repairMode: "existing_parent",
      proposedParent: {
        id: parent.id,
        fullName: parent.fullName,
      },
      releaseIdentity: {
        edition: "Batch C923",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
    });
  });

  test("does not reuse a cross-category generic variant as the parent repair target", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Rock Town" });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Bourbon",
      category: null,
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Rye (Batch 1)",
      category: "rye",
      totalTastings: 8,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Rock Town Arkansas",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      hasExactParent: false,
      repairMode: "create_parent",
      proposedParent: {
        id: null,
        fullName: "Rock Town Arkansas Rye",
      },
      releaseIdentity: {
        edition: "Batch 1",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
    });
  });

  test("reuses the correct parent even when the legacy bottle category is dirty", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Rock Town" });
    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Rye",
      category: "rye",
      totalTastings: 80,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Arkansas Rye (Batch 1)",
      category: "bourbon",
      totalTastings: 8,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Rock Town Arkansas Rye",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      hasExactParent: true,
      repairMode: "existing_parent",
      proposedParent: {
        id: parent.id,
        fullName: parent.fullName,
      },
      releaseIdentity: {
        edition: "Batch 1",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
    });
  });

  test("keeps singleton create-parent repairs in the candidate list", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Lone Release Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      hasExactParent: false,
      repairMode: "create_parent",
      proposedParent: {
        id: null,
        fullName: "Lone Release Distillery Warehouse Session",
      },
      siblingLegacyBottles: [],
    });
  });

  test("falls back to live classifier review when no stored review exists", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Fallback Distillery" });
    const reusableParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Session Archive",
      totalTastings: 30,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const user = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValue({
      ...createClassifierCreateBottleResult(),
      decision: {
        ...createClassifierCreateBottleResult().decision,
        action: "match",
        matchedBottleId: reusableParent.id,
      },
    });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      hasExactParent: false,
      parentResolutionSource: "classifier_review_live",
      repairMode: "existing_parent",
      proposedParent: {
        id: reusableParent.id,
        fullName: reusableParent.fullName,
      },
    });
  });

  test("rewrites create-parent candidates to existing-parent when classifier finds a reviewed parent", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Review Distillery" });
    const reusableParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Session Archive",
      totalTastings: 30,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const user = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValue({
      ...createClassifierCreateBottleResult(),
      decision: {
        ...createClassifierCreateBottleResult().decision,
        action: "match",
        matchedBottleId: reusableParent.id,
      },
    });

    await refreshLegacyReleaseRepairReview({
      legacyBottleId: legacyBottle.id,
    });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      hasExactParent: false,
      parentResolutionSource: "classifier_review_persisted",
      repairMode: "existing_parent",
      proposedParent: {
        id: reusableParent.id,
        fullName: reusableParent.fullName,
      },
    });
  });

  test("ignores stale stored reviews when the release identity changes", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Stale Review Distillery" });
    const reusableParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session",
      totalTastings: 30,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const user = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValue({
      ...createClassifierCreateBottleResult(),
      decision: {
        ...createClassifierCreateBottleResult().decision,
        action: "match",
        matchedBottleId: reusableParent.id,
      },
    });

    await refreshLegacyReleaseRepairReview({
      legacyBottleId: legacyBottle.id,
    });

    await db
      .update(bottles)
      .set({
        fullName: "Warehouse Session (Batch 2)",
      })
      .where(eq(bottles.id, legacyBottle.id));

    classifyBottleReferenceMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      createClassifierCreateBottleResult(),
    );

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      hasExactParent: false,
      repairMode: "create_parent",
      proposedParent: {
        id: null,
        fullName: "Warehouse Session",
      },
      releaseIdentity: {
        edition: "Batch 2",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
    });
  });

  test("blocks create-parent candidates when classifier cannot verify the parent decision", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Blocked Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const user = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValue({
      status: "ignored" as const,
      reason: "reference is too ambiguous",
    });

    await refreshLegacyReleaseRepairReview({
      legacyBottleId: legacyBottle.id,
    });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      classifierBlocker:
        "Classifier could not review parent resolution: reference is too ambiguous",
      hasExactParent: false,
      repairMode: "blocked_classifier",
      proposedParent: {
        id: null,
        fullName: "Blocked Distillery Warehouse Session",
      },
    });
  });

  test("reorders stored reviewed candidates before pagination", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Pagination Distillery" });
    const highPriorityHeuristic = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Reserve (Batch 1)",
      totalTastings: 20,
    });
    const reviewedParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Session Archive",
      totalTastings: 30,
    });
    const reviewedLegacy = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 5,
    });
    const user = await fixtures.User({ mod: true });

    classifyBottleReferenceMock.mockResolvedValue({
      ...createClassifierCreateBottleResult(),
      decision: {
        ...createClassifierCreateBottleResult().decision,
        action: "match",
        matchedBottleId: reviewedParent.id,
      },
    });

    await refreshLegacyReleaseRepairReview({
      legacyBottleId: reviewedLegacy.id,
    });

    classifyBottleReferenceMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      createClassifierCreateBottleResult(),
    );

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse",
        limit: 1,
      },
      { context: { user } },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      legacyBottle: {
        id: reviewedLegacy.id,
      },
      repairMode: "existing_parent",
      proposedParent: {
        id: reviewedParent.id,
        fullName: reviewedParent.fullName,
      },
    });
    expect(result.results[0].legacyBottle.id).not.toBe(
      highPriorityHeuristic.id,
    );
  });

  test("flags sibling clusters behind a dirty exact-name parent as blocked", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const dirtyParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 40,
    });
    await db
      .update(bottles)
      .set({ edition: "Batch 31" })
      .where(eq(bottles.id, dirtyParent.id));
    const batch32 = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
      totalTastings: 10,
    });
    const batch33 = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 33)",
      totalTastings: 8,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "A'bunadh",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === batch32.id,
      ),
    ).toMatchObject({
      blockingParent: {
        id: dirtyParent.id,
        fullName: dirtyParent.fullName,
        totalTastings: dirtyParent.totalTastings,
      },
      hasExactParent: false,
      repairMode: "blocked_dirty_parent",
      proposedParent: {
        id: null,
        fullName: dirtyParent.fullName,
      },
      siblingLegacyBottles: [{ id: batch33.id, fullName: batch33.fullName }],
    });
  });

  test("ignores formatting-only parent matches when release identity is only structured", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Formatting Distillery" });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Archive 15-year-old",
      statedAge: 15,
      totalTastings: 50,
    });
    const legacyRelease = await fixtures.Bottle({
      brandId: brand.id,
      name: "Archive 15 Year Old",
      statedAge: 15,
      releaseYear: 2024,
      totalTastings: 10,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Archive",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyRelease.id,
      ),
    ).toBeUndefined();
  });

  test("treats query wildcards as literal characters", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Percent Distillery" });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "100% Cask Strength",
      totalTastings: 50,
    });
    const percentBatch = await fixtures.Bottle({
      brandId: brand.id,
      name: "100% Cask Strength (Batch 1)",
      totalTastings: 10,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "100 Proof Cask Strength",
      totalTastings: 40,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "100 Proof Cask Strength (Batch 1)",
      totalTastings: 9,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "100% Cask Strength",
      },
      { context: { user } },
    );

    expect(
      result.results.map((candidate) => candidate.legacyBottle.id),
    ).toEqual([percentBatch.id]);
  });

  test("keeps singleton dirty-parent blockers in the candidate list", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const dirtyParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 40,
    });
    await db
      .update(bottles)
      .set({ edition: "Batch 31" })
      .where(eq(bottles.id, dirtyParent.id));
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
      totalTastings: 10,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "A'bunadh",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      blockingParent: {
        id: dirtyParent.id,
        fullName: dirtyParent.fullName,
        totalTastings: dirtyParent.totalTastings,
      },
      hasExactParent: false,
      repairMode: "blocked_dirty_parent",
      proposedParent: {
        id: null,
        fullName: dirtyParent.fullName,
      },
      siblingLegacyBottles: [],
    });
  });

  test("marks create-parent candidates as blocked when another alias owns the parent name", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Alias Conflict Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const conflictingBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Different Product",
      totalTastings: 20,
    });
    await db.insert(bottleAliases).values({
      bottleId: conflictingBottle.id,
      name: "Alias Conflict Distillery Warehouse Session",
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      blockingAlias: {
        bottleFullName: conflictingBottle.fullName,
        bottleId: conflictingBottle.id,
        name: "Alias Conflict Distillery Warehouse Session",
        releaseFullName: null,
        releaseId: null,
      },
      hasExactParent: false,
      repairMode: "blocked_alias_conflict",
      proposedParent: {
        id: null,
        fullName: "Alias Conflict Distillery Warehouse Session",
      },
      siblingLegacyBottles: [],
    });
  });

  test("includes the blocking release when a release alias owns the parent name", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Release Alias Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const parentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Different Product",
      totalTastings: 20,
    });
    const release = await fixtures.BottleRelease({
      bottleId: parentBottle.id,
      edition: "Special Alias",
    });
    await db.insert(bottleAliases).values({
      bottleId: parentBottle.id,
      releaseId: release.id,
      name: "Release Alias Distillery Warehouse Session",
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyBottle.id,
      ),
    ).toMatchObject({
      blockingAlias: {
        bottleFullName: parentBottle.fullName,
        bottleId: parentBottle.id,
        name: "Release Alias Distillery Warehouse Session",
        releaseFullName: release.fullName,
        releaseId: release.id,
      },
      repairMode: "blocked_alias_conflict",
    });
  });

  test("keeps pagination stable when valid candidates extend past the initial scan window", async ({
    fixtures,
  }) => {
    classifyBottleReferenceMock.mockResolvedValue(
      createClassifierCreateBottleResult(),
    );
    const brand = await fixtures.Entity({
      name: "Pagination Probe Distillery",
    });
    const user = await fixtures.User({ mod: true });

    for (let index = 0; index < 240; index += 1) {
      await fixtures.Bottle({
        brandId: brand.id,
        name: `Pagination Probe Single Barrel ${index} (Batch 1)`,
        totalTastings: 1000 - index,
      });
    }

    await fixtures.Bottle({
      brandId: brand.id,
      name: "Pagination Probe Archive Series",
      totalTastings: 50,
    });

    const validCandidateIds: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const bottle = await fixtures.Bottle({
        brandId: brand.id,
        name: `Pagination Probe Archive Series (Batch ${index + 1})`,
        totalTastings: 40 - index,
      });
      validCandidateIds.push(bottle.id);
    }

    const firstPage = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Pagination Probe",
        cursor: 1,
        limit: 15,
      },
      { context: { user } },
    );

    expect(firstPage.results).toHaveLength(15);
    expect(firstPage.rel).toMatchObject({
      nextCursor: 2,
      prevCursor: null,
    });

    const secondPage = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Pagination Probe",
        cursor: 2,
        limit: 15,
      },
      { context: { user } },
    );

    expect(secondPage.results).toHaveLength(15);
    expect(secondPage.rel).toMatchObject({
      nextCursor: 3,
      prevCursor: 1,
    });

    const returnedIds = [
      ...firstPage.results.map((candidate) => candidate.legacyBottle.id),
      ...secondPage.results.map((candidate) => candidate.legacyBottle.id),
    ];

    expect(new Set(returnedIds.slice(0, 20))).toEqual(
      new Set(validCandidateIds),
    );
  }, 15000);
});
