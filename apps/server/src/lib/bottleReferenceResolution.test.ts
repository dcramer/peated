import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottleReleases,
  bottleTombstones,
  bottles,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  lockBottleReferenceResolutionAssignmentInTransaction,
  resolveBottleReferenceTarget,
  type BottleReferenceResolution,
} from "@peated/server/lib/bottleReferenceResolution";
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
  candidates: Array<{ bottleId: number }> = [],
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

function directResolution(bottleId: number): BottleReferenceResolution {
  return {
    assignment: {
      kind: "direct_bottle",
      bottleId,
    },
    source: "exact_alias",
    error: null,
    confidence: null,
    model: null,
    rationale: null,
    classifierEvidence: null,
    createdBottle: false,
  };
}

test("rejects every inactive Bottle before persisting a resolution", async ({
  fixtures,
}) => {
  const unassigned = await fixtures.LegacyBottle();
  const retired = await fixtures.Bottle();
  const retiredGroupMember = await fixtures.Bottle();
  const replacement = await fixtures.Bottle();
  await db.insert(bottleTombstones).values({
    bottleId: retired.id,
    newBottleId: replacement.id,
  });
  await db.insert(bottleGroupTombstones).values({
    groupId: retiredGroupMember.groupId!,
    newGroupId: replacement.groupId!,
    createdByActorId: retiredGroupMember.createdByActorId,
  });

  const context = { caller: "test", operation: "persist" };
  await expect(
    db.transaction((tx) =>
      lockBottleReferenceResolutionAssignmentInTransaction(
        tx,
        directResolution(Number.MAX_SAFE_INTEGER),
        context,
      ),
    ),
  ).rejects.toThrow(
    `Bottle ${Number.MAX_SAFE_INTEGER} does not exist while test.persist is persisting its assignment.`,
  );
  await expect(
    db.transaction((tx) =>
      lockBottleReferenceResolutionAssignmentInTransaction(
        tx,
        directResolution(unassigned.id),
        context,
      ),
    ),
  ).rejects.toThrow(`Bottle ${unassigned.id} is not active`);
  await expect(
    db.transaction((tx) =>
      lockBottleReferenceResolutionAssignmentInTransaction(
        tx,
        directResolution(retired.id),
        context,
      ),
    ),
  ).rejects.toThrow(`Bottle ${retired.id} is retired.`);
  await expect(
    db.transaction((tx) =>
      lockBottleReferenceResolutionAssignmentInTransaction(
        tx,
        directResolution(retiredGroupMember.id),
        context,
      ),
    ),
  ).rejects.toThrow(`Bottle ${retiredGroupMember.id} is not active`);
});

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
    const result = await resolveBottleReferenceTarget({
      reference: {
        name: bottle.fullName,
        url: null,
        imageUrl: null,
        currentBottleId: null,
      },
      aliasLookupNames: [bottle.fullName],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: bottle.id,
      },
      source: "exact_alias",
      createdBottle: false,
      classifierEvidence: null,
    });
    expect(result).not.toHaveProperty("createdRelease");
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("keeps an inactive exact alias visible until persistence rejects it", async ({
    fixtures,
  }) => {
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      name: "Retired Exact Alias",
      bottleId: retired.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    const resolution = await resolveBottleReferenceTarget({
      reference: {
        name: alias.name,
        url: null,
        imageUrl: null,
        currentBottleId: null,
      },
      aliasLookupNames: [alias.name],
      user: await fixtures.User(),
      createdByActorId: retired.createdByActorId,
    });

    expect(resolution).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: retired.id,
      },
      source: "exact_alias",
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
    await expect(
      db.transaction((tx) =>
        lockBottleReferenceResolutionAssignmentInTransaction(tx, resolution, {
          caller: "test",
          operation: "persist",
        }),
      ),
    ).rejects.toThrow(`Bottle ${retired.id} is retired.`);
  });

  test("uses the alias Bottle without reconstructing a catalog target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const parent = await fixtures.Bottle({ name: "Grouped Alias Parent" });
    await fixtures.BottleRelease({ bottleId: parent.id });
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      name: "Grouped Parent Alias",
    });
    const result = await resolveBottleReferenceTarget({
      reference: {
        name: alias.name,
        url: null,
        imageUrl: null,
        currentBottleId: null,
      },
      aliasLookupNames: [alias.name],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: parent.id,
      },
      source: "exact_alias",
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("uses the Bottle directly assigned to a promoted release alias", async ({
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
      name: "Promoted Release Alias",
    });
    const result = await resolveBottleReferenceTarget({
      reference: {
        name: alias.name,
        url: null,
        imageUrl: null,
        currentBottleId: null,
      },
      aliasLookupNames: [alias.name],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: parent.id,
      },
      source: "exact_alias",
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("resolves a direct Bottle alias", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.LegacyBottle({
      name: "Staged Alias Bottle",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Staged Exact Alias",
    });

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: alias.name,
        url: null,
        imageUrl: null,
        currentBottleId: null,
      },
      aliasLookupNames: [alias.name],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: bottle.id,
      },
      source: "exact_alias",
      createdBottle: false,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("assigns the matched Bottle directly", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.Bottle({
      name: "Matched Bottle",
    });
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
        },
        [{ bottleId: bottle.id }],
      ),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Matched Bottle",
        url: null,
        imageUrl: null,
        currentBottleId: null,
      },
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: bottle.id,
      },
      source: "classifier_match",
      error: null,
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

  test("creates a direct Bottle decision with a singleton group", async ({
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
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: expect.any(Number),
      },
      source: "classifier_create_bottle",
      error: null,
      createdBottle: true,
    });
    expect(result).not.toHaveProperty("createdRelease");
    expect(result).not.toHaveProperty("groupId");
    const assignment = result.assignment;
    if (!assignment) {
      throw new Error("Expected classifier creation to return a Bottle.");
    }
    const createdBottleId = assignment.bottleId;
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
    const groupMembers = await db.query.bottles.findMany({
      where: (table, { eq }) => eq(table.groupId, created!.groupId!),
    });
    expect(groupMembers).toHaveLength(1);
    expect(groupMembers[0]).toMatchObject({
      id: assignment.bottleId,
      groupId: created!.groupId,
    });
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
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      assignment: {
        kind: "direct_bottle",
        bottleId: bottle.id,
      },
      source: "classifier_create_bottle",
      error: null,
      createdBottle: false,
    });
    const assignment = result.assignment;
    if (!assignment) {
      throw new Error("Expected classifier reuse to return a Bottle.");
    }
    expect(await countBottles()).toBe(bottleCount);
  });
});
