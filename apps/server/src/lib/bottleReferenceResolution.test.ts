import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
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

function buildCreateReleaseClassification({
  parentBottleId,
  edition,
}: {
  parentBottleId: number;
  edition: string;
}) {
  return buildClassification(
    {
      action: "create_release",
      rationale: "A marketed batch under the known expression.",
      identityScope: "product",
      observation: null,
      identityBasis: null,
      confidenceBasis: null,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId,
      proposedBottle: null,
      proposedRelease: {
        edition,
        statedAge: null,
        abv: 54.1,
        caskStrength: true,
        singleCask: false,
        vintageYear: null,
        releaseYear: 2024,
        description: "Source-backed exact description",
        tastingNotes: null,
        imageUrl: null,
      },
    },
    [{ bottleId: parentBottleId }],
  );
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
      bottleId: bottle.id,
      releaseId: null,
      targetId: target?.id,
      source: "exact_alias",
      createdBottle: false,
      createdRelease: false,
      classifierEvidence: null,
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
      bottleId: bottle.id,
      releaseId: null,
      targetId: null,
      source: "exact_alias",
      createdBottle: false,
      createdRelease: false,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
    expect(
      await db.query.catalogTargets.findFirst({
        where: (catalogTargets, { eq }) =>
          eq(catalogTargets.bottleId, bottle.id),
      }),
    ).toBeUndefined();
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
      bottleId: null,
      releaseId: null,
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
      bottleId: null,
      releaseId: null,
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
      releaseId: null,
      targetId: expect.any(Number),
      source: "classifier_create_bottle",
      error: null,
      createdBottle: true,
      createdRelease: false,
    });
    expect(result).not.toHaveProperty("groupId");
    const created = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, result.bottleId!),
    });
    expect(created).toMatchObject({
      groupId: expect.any(Number),
      name: "Independent Expression - First Edition - 2020 Release - 2008 Vintage - 46.0% ABV",
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
          id: result.targetId,
          bottleId: result.bottleId,
          groupId: created!.groupId,
        }),
      ]),
    );
    expect(await db.select().from(bottleReleases)).toEqual([]);
  });

  test("combines legacy bottle and release evidence into one independent concrete Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle_and_release",
        rationale: "Both stable and exact source evidence are present.",
        identityScope: "product",
        observation: null,
        identityBasis: null,
        confidenceBasis: null,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: {
          name: "Combined Expression",
          series: null,
          category: "rye",
          edition: "Bottle Fallback",
          statedAge: 10,
          caskStrength: true,
          singleCask: false,
          abv: 50,
          vintageYear: 2010,
          releaseYear: 2020,
          brand: { id: null, name: "Combined Brand" },
          distillers: [],
          bottler: null,
        },
        proposedRelease: {
          edition: "Release Edition",
          statedAge: null,
          abv: null,
          caskStrength: false,
          singleCask: null,
          vintageYear: null,
          releaseYear: 2022,
          description: "Exact source description",
          tastingNotes: null,
          imageUrl: null,
        },
      }),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Combined Brand Combined Expression Release Edition",
        url: "https://example.com/combined",
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      releaseId: null,
      targetId: expect.any(Number),
      source: "classifier_create_bottle_and_release",
      error: null,
      createdBottle: true,
      createdRelease: false,
    });
    const created = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, result.bottleId!),
    });
    expect(created).toMatchObject({
      name: "Combined Expression - Release Edition - 2022 Release - 2010 Vintage - 50.0% ABV",
      edition: "Release Edition",
      statedAge: 10,
      abv: 50,
      caskStrength: false,
      singleCask: false,
      vintageYear: 2010,
      releaseYear: 2022,
      description: "Exact source description",
      groupId: expect.any(Number),
    });
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, result.targetId!),
      }),
    ).toMatchObject({
      bottleId: result.bottleId,
      groupId: created!.groupId,
    });
    expect(await db.select().from(bottleReleases)).toEqual([]);
  });

  test("creates a repair-shaped decision as an independent concrete Bottle without mutating its evidence parent", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const parent = await fixtures.Bottle({
      name: "Dirty Parent",
      edition: "Legacy Exact Edition",
    });
    const parentBefore = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, parent.id),
    });
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "repair_parent_and_create_release",
          confidence: 90,
          rationale:
            "The legacy parent is evidence for an independently complete replacement.",
          candidateBottleIds: [parent.id],
          identityScope: "product",
          observation: {
            selector: "21-year-old label",
            caskNumber: null,
            barrelNumber: null,
            bottleNumber: null,
            outturn: null,
            market: null,
            exclusive: null,
          },
          identityBasis: {
            bottleTraits: ["brand", "expression"],
            releaseTraits: ["stated age"],
            observationTraits: ["label selector"],
            yearInterpretation: "none",
            siblingEvidence: "dirty_sibling_candidates",
            uncertainties: [],
          },
          confidenceBasis: {
            positiveEvidence: ["reviewed parent candidate"],
            unresolvedRisks: [],
            toolsUsed: ["initial_local_candidates"],
            webEvidence: "not_used",
          },
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: parent.id,
          proposedBottle: {
            name: "Speyside",
            series: null,
            brand: {
              id: null,
              name: "Shieldaig",
            },
            category: "single_malt",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            distillers: [],
            bottler: null,
          },
          proposedRelease: {
            statedAge: 21,
          },
        },
        [{ bottleId: parent.id }],
      ),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Shieldaig Speyside Single Malt 21-year-old Scotch Whisky",
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
      releaseId: null,
      source: "classifier_repair_parent_and_create_release",
      error: null,
      confidence: null,
      createdBottle: true,
      createdRelease: false,
      classifierEvidence: {
        action: "repair_parent_and_create_release",
        parentBottleId: parent.id,
        identityScope: "product",
        observation: {
          selector: "21-year-old label",
          caskNumber: null,
          barrelNumber: null,
          bottleNumber: null,
          outturn: null,
          market: null,
          exclusive: null,
        },
        identityBasis: {
          bottleTraits: ["brand", "expression"],
          releaseTraits: ["stated age"],
          observationTraits: ["label selector"],
          yearInterpretation: "none",
          siblingEvidence: "dirty_sibling_candidates",
          uncertainties: [],
        },
        confidenceBasis: {
          positiveEvidence: ["reviewed parent candidate"],
          unresolvedRisks: [],
          toolsUsed: ["initial_local_candidates"],
          webEvidence: "not_used",
        },
      },
    });
    expect(result.bottleId).not.toBe(parent.id);
    expect(result.targetId).toEqual(expect.any(Number));

    const created = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, result.bottleId!),
    });
    expect(created).toMatchObject({
      name: "Speyside - 21-year-old",
      statedAge: 21,
      groupId: expect.any(Number),
    });
    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, parent.id),
      }),
    ).toEqual(parentBefore);
    expect(await db.select().from(bottleReleases)).toEqual([]);
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, result.targetId!),
      }),
    ).toMatchObject({
      bottleId: result.bottleId,
      groupId: created!.groupId,
    });
  });

  test("creates release-shaped decisions as concrete Bottles in the trusted source group", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const source = await fixtures.Bottle({ statedAge: 12 });
    const sourceBefore = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, source.id),
    });
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "create_release",
          rationale: "A marketed batch under the known expression.",
          identityScope: "product",
          observation: null,
          identityBasis: null,
          confidenceBasis: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: source.id,
          proposedBottle: null,
          proposedRelease: {
            edition: "Batch 24",
            statedAge: null,
            abv: 54.1,
            caskStrength: true,
            singleCask: false,
            vintageYear: null,
            releaseYear: 2024,
            description: "Source-backed exact description",
            tastingNotes: null,
            imageUrl: null,
          },
        },
        [{ bottleId: source.id }],
      ),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: `${source.fullName} Batch 24`,
        url: "https://example.com/batch-24",
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      releaseId: null,
      source: "classifier_create_release",
      error: null,
      createdBottle: true,
      createdRelease: false,
    });
    expect(result.bottleId).not.toBe(source.id);
    expect(result.targetId).toEqual(expect.any(Number));
    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, result.bottleId!),
      }),
    ).toMatchObject({
      groupId: source.groupId,
      edition: "Batch 24",
      statedAge: 12,
      abv: 54.1,
      releaseYear: 2024,
    });
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, result.targetId!),
      }),
    ).toMatchObject({
      bottleId: result.bottleId,
      groupId: source.groupId,
    });
    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, source.id),
      }),
    ).toEqual(sourceBefore);
    expect(await db.select().from(bottleReleases)).toEqual([]);
  });

  test("replays a canonical create_release duplicate only within its trusted group", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const source = await fixtures.Bottle({
      name: "Trusted Replay Family",
      statedAge: 12,
    });
    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateReleaseClassification({
        parentBottleId: source.id,
        edition: "Batch 24",
      }),
    );
    const reference = {
      name: `${source.fullName} Batch 24`,
      url: "https://example.com/trusted-replay",
      imageUrl: null,
      currentBottleId: null,
      currentReleaseId: null,
    };

    const first = await resolveBottleReferenceTarget({
      reference,
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });
    const countsBeforeReplay = await getCatalogRowCounts();
    const canonicalAlias = await db.query.bottleAliases.findFirst({
      where: (aliases, { and, eq }) =>
        and(
          eq(aliases.bottleId, first.bottleId!),
          eq(aliases.assignmentSource, "canonical"),
        ),
    });

    const replay = await resolveBottleReferenceTarget({
      reference,
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(canonicalAlias).toBeDefined();
    expect(replay).toMatchObject({
      bottleId: first.bottleId,
      releaseId: null,
      targetId: first.targetId,
      source: "classifier_create_release",
      error: null,
      createdBottle: false,
      createdRelease: false,
    });
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, replay.targetId!),
      }),
    ).toMatchObject({
      bottleId: replay.bottleId,
      groupId: source.groupId,
    });
    expect(await getCatalogRowCounts()).toEqual(countsBeforeReplay);
  });

  test("rejects a canonical create_release collision from another trusted group without writes", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const brand = await fixtures.Entity({ name: "Cross Group Guard Brand" });
    const firstSource = await fixtures.Bottle({
      brandId: brand.id,
      name: "Cross Group Family",
      statedAge: 12,
    });
    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateReleaseClassification({
        parentBottleId: firstSource.id,
        edition: "Batch 24",
      }),
    );
    const existing = await resolveBottleReferenceTarget({
      reference: {
        name: `${firstSource.fullName} Batch 24`,
        url: "https://example.com/cross-group-existing",
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });
    const otherSource = await fixtures.Bottle({
      brandId: brand.id,
      name: "Temporary Cross Group Family",
      statedAge: 12,
    });
    await db
      .update(bottles)
      .set({ name: firstSource.name, fullName: firstSource.fullName })
      .where(eq(bottles.id, otherSource.id));
    await db
      .update(bottleGroups)
      .set({
        name: firstSource.name,
        fullName: firstSource.fullName,
        statedAge: firstSource.statedAge,
      })
      .where(eq(bottleGroups.id, otherSource.groupId!));
    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateReleaseClassification({
        parentBottleId: otherSource.id,
        edition: "Batch 24",
      }),
    );
    const countsBeforeCollision = await getCatalogRowCounts();

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: `${firstSource.fullName} Batch 24 duplicate`,
        url: "https://example.com/cross-group-collision",
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(existing).toMatchObject({
      bottleId: expect.any(Number),
      targetId: expect.any(Number),
      createdBottle: true,
    });
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, existing.targetId!),
      }),
    ).toMatchObject({
      bottleId: existing.bottleId,
      groupId: firstSource.groupId,
    });
    expect(result).toMatchObject({
      bottleId: null,
      releaseId: null,
      targetId: null,
      source: "unresolved",
      classifierEvidence: null,
      createdBottle: false,
      createdRelease: false,
    });
    expect(result.error).toBeInstanceOf(Error);
    expect(await getCatalogRowCounts()).toEqual(countsBeforeCollision);
  });

  test("returns an unresolved result when classifier release evidence includes a direct image URL", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const source = await fixtures.Bottle();
    const bottleCount = await countBottles();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "create_release",
          rationale: "Image still requires canonical upload approval.",
          identityScope: "product",
          observation: null,
          identityBasis: null,
          confidenceBasis: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: source.id,
          proposedBottle: null,
          proposedRelease: {
            edition: "Image Edition",
            statedAge: null,
            abv: null,
            caskStrength: null,
            singleCask: null,
            vintageYear: null,
            releaseYear: null,
            description: null,
            tastingNotes: null,
            imageUrl: "https://example.com/unapproved.jpg",
          },
        },
        [{ bottleId: source.id }],
      ),
    );

    const result = await resolveBottleReferenceTarget({
      reference: {
        name: "Image Edition",
        url: "https://example.com/source",
        imageUrl: "https://example.com/unapproved.jpg",
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [],
      createdByActorId: actor.id,
      user,
    });

    expect(result).toMatchObject({
      releaseId: null,
      bottleId: null,
      targetId: null,
      source: "unresolved",
      classifierEvidence: null,
      createdBottle: false,
      createdRelease: false,
    });
    expect(result.error?.message).toContain(
      "imageUrl cannot be translated to canonical Bottle creation",
    );
    expect(await countBottles()).toBe(bottleCount);
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
      bottleId: bottle.id,
      releaseId: null,
      targetId: expect.any(Number),
      source: "classifier_create_bottle",
      error: null,
      createdBottle: false,
      createdRelease: false,
    });
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, result.targetId!),
      }),
    ).toMatchObject({ bottleId: bottle.id, groupId: bottle.groupId });

    expect(await countBottles()).toBe(bottleCount);
  });

  test("reuses existing SMWS bottles by code for combined classifier create decisions", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const brand = await fixtures.Entity({
      type: ["brand", "bottler"],
      name: "SMWS Combined Guard Society",
      shortName: "SMWS",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.331 Ultra hoggie",
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.3310 False lead",
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "135.331 False lead",
    });

    const bottleCount = await countBottles();

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle_and_release",
        confidence: 100,
        identityScope: "exact_cask",
        observation: {
          caskNumber: "35.331",
        },
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: buildSmwsProposedBottle(),
        proposedRelease: {
          edition: "Ultra hoggie",
          statedAge: null,
          abv: null,
          caskStrength: null,
          singleCask: null,
          vintageYear: null,
          releaseYear: null,
          description: null,
          tastingNotes: null,
          imageUrl: null,
        },
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
      bottleId: bottle.id,
      releaseId: null,
      targetId: expect.any(Number),
      source: "classifier_create_bottle_and_release",
      error: null,
      createdBottle: false,
      createdRelease: false,
    });
    expect(
      await db.query.catalogTargets.findFirst({
        where: (targets, { eq }) => eq(targets.id, result.targetId!),
      }),
    ).toMatchObject({ bottleId: bottle.id, groupId: bottle.groupId });
    expect(await countBottles()).toBe(bottleCount);
  });
});
