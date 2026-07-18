import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);

function buildClassification(
  decision: Record<string, unknown>,
  candidates: Array<{
    bottleId: number;
    releaseId?: number | null;
  }> = [],
) {
  return {
    status: "classified" as const,
    decision: {
      confidence: 0.75,
      rationale: "test fixture",
      candidateBottleIds: [],
      ...decision,
    },
    artifacts: {
      extractedIdentity: null,
      candidates,
      searchEvidence: [],
      resolvedEntities: [],
    },
  };
}

function buildSmwsProposedBottle() {
  return {
    name: "35.331",
    series: null,
    category: "single_malt",
    edition: null,
    statedAge: null,
    caskStrength: null,
    singleCask: true,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: {
      id: null,
      name: "SMWS",
    },
    distillers: [],
    bottler: {
      id: null,
      name: "SMWS",
    },
  };
}

async function countBottles() {
  const rows = await db.select({ id: bottles.id }).from(bottles);
  return rows.length;
}

async function getCatalogRowCounts() {
  const [bottleRows, groupRows, targetRows, aliasRows, releaseRows] =
    await Promise.all([
      db.select({ id: bottles.id }).from(bottles),
      db.select({ id: bottleGroups.id }).from(bottleGroups),
      db.select({ id: catalogTargets.id }).from(catalogTargets),
      db.select({ name: bottleAliases.name }).from(bottleAliases),
      db.select({ id: bottleReleases.id }).from(bottleReleases),
    ]);
  return {
    bottles: bottleRows.length,
    groups: groupRows.length,
    targets: targetRows.length,
    aliases: aliasRows.length,
    releases: releaseRows.length,
  };
}

describe("resolveBottleReferenceTarget", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );
  });

  test("uses exact aliases without calling the classifier", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: bottle.fullName,
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [bottle.fullName],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "target",
        target: {
          targetId: target?.id,
          groupId: bottle.groupId,
          bottleId: bottle.id,
        },
        consumerIdentity: { bottleId: bottle.id, releaseId: null },
      },
      source: "exact_alias",
      createdBottle: false,
      classifierEvidence: null,
    });
    expect(result).not.toHaveProperty("createdRelease");
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("keeps a measured parent pair when a targetless alias resolves to its generic target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const parent = await fixtures.Bottle({ name: "Grouped Alias Parent" });
    await fixtures.BottleRelease({ bottleId: parent.id });
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      targetId: null,
      name: "Grouped Parent Alias",
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { and, eq, isNull }) =>
        and(eq(targets.groupId, parent.groupId!), isNull(targets.bottleId)),
    });

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: alias.name,
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [alias.name],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "target",
        target: {
          targetId: genericTarget?.id,
          groupId: parent.groupId,
          bottleId: null,
        },
        consumerIdentity: { bottleId: parent.id, releaseId: null },
      },
      source: "exact_alias",
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("keeps a promoted release pair while resolving its exact target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const parent = await fixtures.LegacyBottle({
      name: "Promoted Alias Parent",
    });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promotedBottle = await fixtures.Bottle({
      name: "Promoted Alias Bottle",
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
    });
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Promoted Release Alias",
    });
    const promotedTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { eq }) => eq(targets.bottleId, promotedBottle.id),
    });

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: alias.name,
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [alias.name],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "target",
        target: {
          targetId: promotedTarget?.id,
          groupId: promotedBottle.groupId,
          bottleId: promotedBottle.id,
        },
        consumerIdentity: {
          bottleId: parent.id,
          releaseId: release.id,
        },
      },
      source: "exact_alias",
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("preserves targetless staged aliases without inventing a target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.LegacyBottle({
      name: "Staged Alias Bottle",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: null,
      name: "Staged Exact Alias",
    });

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: alias.name,
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [alias.name],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "staged_targetless",
        consumerIdentity: { bottleId: bottle.id, releaseId: null },
        stagedTargetless: {
          bottleId: bottle.id,
          releaseId: null,
          stagedReason: "LEGACY_PARENT_WITHOUT_GROUP",
        },
      },
      source: "exact_alias",
      createdBottle: false,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
    expect(
      await db.query.catalogTargets.findFirst({
        where: (catalogTargets, { eq }) =>
          eq(catalogTargets.bottleId, bottle.id),
      }),
    ).toBeUndefined();
  });

  test("preserves an unpromoted classifier match as explicit staged identity", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const parent = await fixtures.LegacyBottle({
      name: "Unpromoted Match Parent",
    });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: parent.id,
          matchedReleaseId: release.id,
          candidateBottleIds: [parent.id],
        },
        [{ bottleId: parent.id, releaseId: release.id }],
      ),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Unpromoted Match Parent Release",
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "staged_targetless",
        consumerIdentity: {
          bottleId: parent.id,
          releaseId: release.id,
        },
        stagedTargetless: {
          bottleId: parent.id,
          releaseId: release.id,
          stagedReason: "RELEASE_WITHOUT_COMPLETED_PROMOTION",
        },
      },
      source: "classifier_match",
      error: null,
    });
  });

  test("surfaces non-staged classifier target mapping errors", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const selectedParent = await fixtures.LegacyBottle({
      name: "Selected Parent",
    });
    const otherParent = await fixtures.LegacyBottle({ name: "Other Parent" });
    const otherRelease = await fixtures.BottleRelease({
      bottleId: otherParent.id,
    });
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: selectedParent.id,
          matchedReleaseId: otherRelease.id,
          candidateBottleIds: [selectedParent.id],
        },
        [{ bottleId: selectedParent.id, releaseId: otherRelease.id }],
      ),
    );

    await expect(
      resolveBottleReferenceTarget({
        reference: {
          name: "Invalid Cross-parent Match",
          url: null,
          imageUrl: null,
          currentBottleId: null,
          currentReleaseId: null,
        },
        createdByActorId: actor.id,
        user,
      }),
    ).rejects.toMatchObject({
      code: "CATALOG_TARGET_INVALID_MAPPING",
      reason: "the release does not belong to the supplied parent Bottle",
    });
  });

  test("does not normalize alias lookup names internally", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Ardbeg 10 years old",
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: ["Ardbeg 10 years old"],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: null,
      source: "unresolved",
    });
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
    expect(classifyBottleReferenceMock).toHaveBeenCalledWith({
      reference: {
        name: "Ardbeg 10 years old",
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      extractedIdentity: null,
    });
  });

  test("does not use ignored aliases as fast-path matches", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Ardbeg Ten Years",
      ignored: true,
      assignmentSource: "human_approved",
    });

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Ardbeg Ten Years",
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: ["Ardbeg Ten Years"],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: null,
      source: "unresolved",
    });
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
  });

  test("creates a bottle-shaped decision with a singleton group and exact target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle",
        rationale: "The exact marketed Bottle is missing.",
        identityScope: "product",
        observation: null,
        identityBasis: null,
        confidenceBasis: null,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: {
          name: "Independent Expression",
          series: null,
          category: "single_malt",
          edition: "First Edition",
          statedAge: 12,
          caskStrength: false,
          singleCask: false,
          abv: 46,
          vintageYear: 2008,
          releaseYear: 2020,
          brand: { id: null, name: "Classifier Brand" },
          distillers: [],
          bottler: null,
        },
        proposedRelease: null,
      }),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Classifier Brand Independent Expression First Edition",
        url: "https://example.com/independent",
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "target",
        target: { targetId: expect.any(Number) },
        consumerIdentity: {
          bottleId: expect.any(Number),
          releaseId: null,
        },
      },
      source: "classifier_create_bottle",
      error: null,
      createdBottle: true,
    });
    expect(result).not.toHaveProperty("createdRelease");
    expect(result).not.toHaveProperty("groupId");
    const assignment = result.assignment;
    if (!assignment || assignment.kind !== "target") {
      throw new Error(
        "Expected classifier creation to return an exact target.",
      );
    }
    const createdBottleId = assignment.consumerIdentity.bottleId;
    if (createdBottleId === null) {
      throw new Error(
        "Expected classifier creation to retain Bottle identity.",
      );
    }
    const created = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, createdBottleId),
    });
    expect(created).toMatchObject({
      groupId: expect.any(Number),
      name: "Independent Expression - First Edition - 12-year-old - 2020 Release - 2008 Vintage - 46.0% ABV",
      edition: "First Edition",
      statedAge: 12,
      abv: 46,
    });
    const groupTargets = await db.query.catalogTargets.findMany({
      where: (targets, { eq }) => eq(targets.groupId, created!.groupId!),
    });
    expect(groupTargets).toHaveLength(2);
    expect(groupTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bottleId: null }),
        expect.objectContaining({
          id: assignment.target.targetId,
          bottleId: assignment.consumerIdentity.bottleId,
          groupId: created!.groupId,
        }),
      ]),
    );
    expect(await db.select().from(bottleReleases)).toEqual([]);
  });

  test("reuses existing SMWS bottles by code when a classifier create omits the subtitle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const brand = await fixtures.Entity({
      type: ["brand", "bottler"],
      name: "SMWS Guard Society",
      shortName: "SMWS",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.331 Ultra hoggie",
      singleCask: true,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.3310 False lead",
      singleCask: true,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "135.331 False lead",
      singleCask: true,
    });

    const bottleCount = await countBottles();

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle",
        confidence: 100,
        identityScope: "exact_cask",
        observation: {
          caskNumber: "35.331",
        },
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: buildSmwsProposedBottle(),
        proposedRelease: null,
      }),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "SMWS 35.331",
        url: null,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "target",
        target: { targetId: expect.any(Number) },
        consumerIdentity: { bottleId: bottle.id, releaseId: null },
      },
      source: "classifier_create_bottle",
      error: null,
      createdBottle: false,
    });
    const assignment = result.assignment;
    if (!assignment || assignment.kind !== "target") {
      throw new Error("Expected classifier reuse to return an exact target.");
    }
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, assignment.target.targetId),
      }),
    ).toMatchObject({ bottleId: bottle.id, groupId: bottle.groupId });

    expect(await countBottles()).toBe(bottleCount);
  });
});
