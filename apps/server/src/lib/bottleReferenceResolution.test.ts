import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);

function buildClassification(decision: Record<string, unknown>) {
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
      candidates: [],
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
        currentReleaseId: null,
      },
      aliasLookupNames: [bottle.fullName],
      user,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      source: "exact_alias",
      createdBottle: false,
      createdRelease: false,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("does not normalize alias lookup names internally", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
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
      user,
    });

    expect(result).toMatchObject({
      bottleId: null,
      releaseId: null,
      source: "unresolved",
    });
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
  });

  test("treats parent repair plus release creation as unresolved without an error", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "repair_parent_and_create_release",
        confidence: 90,
        rationale:
          "The parent must be repaired into a reusable bottle before creating the supported child release.",
        candidateBottleIds: [44175],
        identityScope: "product",
        observation: null,
        identityBasis: null,
        confidenceBasis: null,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: 44175,
        proposedBottle: {
          name: "Speyside",
          brand: {
            name: "Shieldaig",
          },
          category: "single_malt",
          statedAge: null,
        },
        proposedRelease: {
          statedAge: 21,
        },
      }),
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
      user,
    });

    expect(result).toMatchObject({
      bottleId: null,
      releaseId: null,
      source: "unresolved",
      error: null,
      confidence: 90,
      createdBottle: false,
      createdRelease: false,
    });
  });

  test("reuses existing SMWS bottles by code when a classifier create omits the subtitle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
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
      user,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      source: "classifier_create_bottle",
      createdBottle: false,
      createdRelease: false,
    });

    expect(await countBottles()).toBe(bottleCount);
  });

  test("reuses existing SMWS bottles by code for combined classifier create decisions", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
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
      user,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      source: "classifier_create_bottle_and_release",
      createdBottle: false,
      createdRelease: true,
    });
    expect(await countBottles()).toBe(bottleCount);
  });
});
