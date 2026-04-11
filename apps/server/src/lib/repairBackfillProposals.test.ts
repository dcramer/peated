import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCanonRepairCandidates } from "@peated/server/lib/canonRepairCandidates";
import { getDirtyParentAgeRepairCandidates } from "@peated/server/lib/dirtyParentAgeRepairCandidates";
import { getLegacyReleaseRepairCandidates } from "@peated/server/lib/legacyReleaseRepairCandidates";
import {
  getRepairBackfillProposals,
  type RepairBackfillProposal,
} from "@peated/server/lib/repairBackfillProposals";

vi.mock("@peated/server/lib/canonRepairCandidates", () => ({
  getCanonRepairCandidates: vi.fn(),
}));

vi.mock("@peated/server/lib/dirtyParentAgeRepairCandidates", () => ({
  getDirtyParentAgeRepairCandidates: vi.fn(),
}));

vi.mock("@peated/server/lib/legacyReleaseRepairCandidates", () => ({
  getLegacyReleaseRepairCandidates: vi.fn(),
}));

const getLegacyReleaseRepairCandidatesMock = vi.mocked(
  getLegacyReleaseRepairCandidates,
);
const getDirtyParentAgeRepairCandidatesMock = vi.mocked(
  getDirtyParentAgeRepairCandidates,
);
const getCanonRepairCandidatesMock = vi.mocked(getCanonRepairCandidates);

function createLegacyBottleMock(overrides: Record<string, unknown>) {
  return {
    id: 1,
    brandId: 1,
    category: null,
    fullName: "Legacy Bottle",
    edition: null,
    releaseYear: null,
    numReleases: 0,
    totalTastings: null,
    ...overrides,
  };
}

function createAgeBottleMock(overrides: Record<string, unknown>) {
  return {
    id: 1,
    fullName: "Dirty Parent",
    name: "Dirty Parent",
    statedAge: 40,
    numReleases: 1,
    totalTastings: 0,
    edition: null,
    releaseYear: null,
    vintageYear: null,
    abv: null,
    singleCask: null,
    caskStrength: null,
    caskFill: null,
    caskType: null,
    caskSize: null,
    ...overrides,
  };
}

describe("getRepairBackfillProposals", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          bottle: createAgeBottleMock({
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
            name: "Rare Cask Release",
            statedAge: 40,
            numReleases: 2,
            totalTastings: 9,
          }),
          conflictingReleases: [
            {
              id: 22,
              fullName: "Glenglassaugh 1978 Rare Cask Release - Batch 1",
              statedAge: 35,
              totalTastings: 4,
            },
          ],
          repairMode: "create_release",
          targetRelease: {
            id: null,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
            statedAge: 40,
            totalTastings: null,
          },
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    getCanonRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          bottle: {
            id: 31,
            fullName: "Elijah Craig Barrel Proof Kentucky Straight Bourbon",
            numReleases: 0,
            totalTastings: 3,
          },
          targetBottle: {
            id: 32,
            fullName: "Elijah Craig Barrel Proof",
            numReleases: 5,
            totalTastings: 24,
          },
          variantBottles: [],
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });
  });

  test("collects paginated release proposals and normalizes summary counts", async () => {
    getLegacyReleaseRepairCandidatesMock
      .mockResolvedValueOnce({
        results: [
          {
            blockingAlias: null,
            blockingParent: null,
            legacyBottle: createLegacyBottleMock({
              id: 11,
              fullName: "Aberlour A'bunadh Batch 32",
              edition: "Batch 32",
              totalTastings: 12,
            }),
            proposedParent: {
              id: 12,
              fullName: "Aberlour A'bunadh",
              totalTastings: 200,
            },
            releaseIdentity: {
              edition: "Batch 32",
              releaseYear: null,
              markerSources: ["name_batch"],
            },
            siblingLegacyBottles: [
              {
                id: 13,
                fullName: "Aberlour A'bunadh Batch 31",
              },
            ],
            hasExactParent: true,
            repairMode: "existing_parent",
          },
        ],
        rel: {
          nextCursor: 2,
          prevCursor: null,
        },
      })
      .mockResolvedValueOnce({
        results: [
          {
            blockingAlias: {
              name: "Lagavulin Distillers Edition",
              bottleId: 42,
              bottleFullName: "Lagavulin Distillers Edition",
              releaseId: null,
              releaseFullName: null,
            },
            blockingParent: null,
            legacyBottle: createLegacyBottleMock({
              id: 41,
              fullName: "Lagavulin Distillers Edition 2011 Release",
              edition: "2011 Release",
              releaseYear: 2011,
              totalTastings: 8,
            }),
            proposedParent: {
              id: null,
              fullName: "Lagavulin Distillers Edition",
              totalTastings: null,
            },
            releaseIdentity: {
              edition: "2011 Release",
              releaseYear: 2011,
              markerSources: ["structured_edition"],
            },
            siblingLegacyBottles: [],
            hasExactParent: false,
            repairMode: "blocked_alias_conflict",
          },
        ],
        rel: {
          nextCursor: null,
          prevCursor: 1,
        },
      });

    const result = await getRepairBackfillProposals({
      perTypeLimit: 2,
    });

    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(1, {
      cursor: 1,
      limit: 2,
      query: "",
    });
    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(2, {
      cursor: 2,
      limit: 2,
      query: "",
    });
    expect(result.summary).toEqual({
      total: 4,
      automationEligible: 1,
      automationBlocked: 3,
      byType: {
        release: 2,
        age: 1,
        canon: 1,
      },
      byActionability: {
        apply: 2,
        blocked: 1,
        manual: 1,
      },
      byRepairMode: {
        release: {
          existing_parent: 1,
          create_parent: 0,
          blocked_alias_conflict: 1,
          blocked_dirty_parent: 0,
        },
        age: {
          existing_release: 0,
          create_release: 1,
        },
        canon: {
          review_required: 1,
        },
      },
    });
    expect(result.proposals).toEqual(
      expect.arrayContaining<RepairBackfillProposal>([
        expect.objectContaining({
          type: "release",
          actionability: "apply",
          adminHref:
            "/admin/release-repairs?query=Aberlour%20A'bunadh%20Batch%2032",
          siblingCount: 1,
        }),
        expect.objectContaining({
          type: "release",
          actionability: "blocked",
          adminHref:
            "/admin/release-repairs?query=Lagavulin%20Distillers%20Edition%202011%20Release",
          blockingAlias: expect.objectContaining({
            name: "Lagavulin Distillers Edition",
          }),
        }),
        expect.objectContaining({
          type: "age",
          adminHref:
            "/admin/age-repairs?query=Glenglassaugh%201978%20Rare%20Cask%20Release",
        }),
        expect.objectContaining({
          type: "canon",
          actionability: "manual",
          adminHref:
            "/admin/canon-repairs?query=Elijah%20Craig%20Barrel%20Proof%20Kentucky%20Straight%20Bourbon",
        }),
      ]),
    );
  });

  test("can filter down to directly applyable repair proposals", async () => {
    getLegacyReleaseRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          blockingAlias: null,
          blockingParent: null,
          legacyBottle: createLegacyBottleMock({
            id: 11,
            fullName: "Aberlour A'bunadh Batch 32",
            edition: "Batch 32",
            totalTastings: 12,
          }),
          proposedParent: {
            id: 12,
            fullName: "Aberlour A'bunadh",
            totalTastings: 200,
          },
          releaseIdentity: {
            edition: "Batch 32",
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: true,
          repairMode: "existing_parent",
        },
        {
          blockingAlias: null,
          blockingParent: {
            id: 17,
            fullName: "Dirty Parent",
            totalTastings: 10,
          },
          legacyBottle: createLegacyBottleMock({
            id: 16,
            fullName: "Dirty Parent Batch 4",
            edition: "Batch 4",
            totalTastings: 5,
          }),
          proposedParent: {
            id: 17,
            fullName: "Dirty Parent",
            totalTastings: 10,
          },
          releaseIdentity: {
            edition: "Batch 4",
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: true,
          repairMode: "blocked_dirty_parent",
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    const result = await getRepairBackfillProposals({
      onlyActionable: true,
      types: ["release", "canon"],
    });

    expect(result.summary).toEqual({
      total: 1,
      automationEligible: 1,
      automationBlocked: 0,
      byType: {
        release: 1,
        age: 0,
        canon: 0,
      },
      byActionability: {
        apply: 1,
        blocked: 0,
        manual: 0,
      },
      byRepairMode: {
        release: {
          existing_parent: 1,
          create_parent: 0,
          blocked_alias_conflict: 0,
          blocked_dirty_parent: 0,
        },
        age: {
          existing_release: 0,
          create_release: 0,
        },
        canon: {
          review_required: 0,
        },
      },
    });
    expect(result.proposals).toEqual([
      expect.objectContaining({
        type: "release",
        actionability: "apply",
        repairMode: "existing_parent",
      }),
    ]);
  });

  test("marks only the narrow unattended-safe subset as automation eligible", async () => {
    getLegacyReleaseRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          blockingAlias: null,
          blockingParent: null,
          legacyBottle: createLegacyBottleMock({
            id: 11,
            fullName: "Aberlour A'bunadh Batch 32",
            edition: "Batch 32",
            totalTastings: 12,
          }),
          proposedParent: {
            id: 12,
            fullName: "Aberlour A'bunadh",
            totalTastings: 200,
          },
          releaseIdentity: {
            edition: "Batch 32",
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: true,
          repairMode: "existing_parent",
        },
        {
          blockingAlias: null,
          blockingParent: null,
          legacyBottle: createLegacyBottleMock({
            id: 13,
            fullName:
              "Elijah Craig Barrel Proof Kentucky Straight Bourbon (Batch C923)",
            edition: "Batch C923",
            totalTastings: 9,
          }),
          proposedParent: {
            id: 14,
            fullName: "Elijah Craig Barrel Proof",
            totalTastings: 180,
          },
          releaseIdentity: {
            edition: "Batch C923",
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: false,
          repairMode: "existing_parent",
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          bottle: createAgeBottleMock({
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
            name: "Rare Cask Release",
            statedAge: 40,
            numReleases: 2,
            totalTastings: 9,
          }),
          conflictingReleases: [],
          repairMode: "existing_release",
          targetRelease: {
            id: 22,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
            statedAge: 40,
            totalTastings: 7,
          },
        },
        {
          bottle: createAgeBottleMock({
            id: 23,
            fullName: "Another Dirty Parent",
            name: "Another Dirty Parent",
            statedAge: 18,
            numReleases: 1,
            totalTastings: 3,
          }),
          conflictingReleases: [],
          repairMode: "create_release",
          targetRelease: {
            id: null,
            fullName: "Another Dirty Parent 18-year-old",
            statedAge: 18,
            totalTastings: null,
          },
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    const result = await getRepairBackfillProposals({
      perTypeLimit: 10,
    });

    expect(result.proposals).toEqual(
      expect.arrayContaining<RepairBackfillProposal>([
        expect.objectContaining({
          type: "release",
          bottle: expect.objectContaining({ id: 11 }),
          automationEligible: true,
          automationBlockers: [],
        }),
        expect.objectContaining({
          type: "release",
          bottle: expect.objectContaining({ id: 13 }),
          automationEligible: false,
          automationBlockers: [
            "release repair only has an exactish reusable parent match",
          ],
        }),
        expect.objectContaining({
          type: "age",
          bottle: expect.objectContaining({ id: 21 }),
          automationEligible: true,
          automationBlockers: [],
        }),
        expect.objectContaining({
          type: "age",
          bottle: expect.objectContaining({ id: 23 }),
          automationEligible: false,
          automationBlockers: ["age repair would create a new release"],
        }),
        expect.objectContaining({
          type: "canon",
          automationEligible: false,
          automationBlockers: ["canon repair requires moderator review"],
        }),
      ]),
    );
  });

  test("can filter down to unattended-safe repair proposals", async () => {
    getLegacyReleaseRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          blockingAlias: null,
          blockingParent: null,
          legacyBottle: createLegacyBottleMock({
            id: 11,
            fullName: "Aberlour A'bunadh Batch 32",
            edition: "Batch 32",
            totalTastings: 12,
          }),
          proposedParent: {
            id: 12,
            fullName: "Aberlour A'bunadh",
            totalTastings: 200,
          },
          releaseIdentity: {
            edition: "Batch 32",
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: true,
          repairMode: "existing_parent",
        },
        {
          blockingAlias: null,
          blockingParent: null,
          legacyBottle: createLegacyBottleMock({
            id: 13,
            fullName:
              "Elijah Craig Barrel Proof Kentucky Straight Bourbon (Batch C923)",
            edition: "Batch C923",
            totalTastings: 9,
          }),
          proposedParent: {
            id: 14,
            fullName: "Elijah Craig Barrel Proof",
            totalTastings: 180,
          },
          releaseIdentity: {
            edition: "Batch C923",
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: false,
          repairMode: "existing_parent",
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          bottle: createAgeBottleMock({
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
            name: "Rare Cask Release",
            statedAge: 40,
            numReleases: 2,
            totalTastings: 9,
          }),
          conflictingReleases: [],
          repairMode: "existing_release",
          targetRelease: {
            id: 22,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
            statedAge: 40,
            totalTastings: 7,
          },
        },
        {
          bottle: createAgeBottleMock({
            id: 23,
            fullName: "Another Dirty Parent",
            name: "Another Dirty Parent",
            statedAge: 18,
            numReleases: 1,
            totalTastings: 3,
          }),
          conflictingReleases: [],
          repairMode: "create_release",
          targetRelease: {
            id: null,
            fullName: "Another Dirty Parent 18-year-old",
            statedAge: 18,
            totalTastings: null,
          },
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    const result = await getRepairBackfillProposals({
      onlyAutomationEligible: true,
      perTypeLimit: 10,
    });

    expect(result.summary).toEqual({
      total: 2,
      automationEligible: 2,
      automationBlocked: 0,
      byType: {
        release: 1,
        age: 1,
        canon: 0,
      },
      byActionability: {
        apply: 2,
        blocked: 0,
        manual: 0,
      },
      byRepairMode: {
        release: {
          existing_parent: 1,
          create_parent: 0,
          blocked_alias_conflict: 0,
          blocked_dirty_parent: 0,
        },
        age: {
          existing_release: 1,
          create_release: 0,
        },
        canon: {
          review_required: 0,
        },
      },
    });
    expect(result.proposals).toEqual([
      expect.objectContaining({
        type: "release",
        bottle: expect.objectContaining({ id: 11 }),
        automationEligible: true,
      }),
      expect.objectContaining({
        type: "age",
        bottle: expect.objectContaining({ id: 21 }),
        automationEligible: true,
      }),
    ]);
  });

  test("keeps paging until it finds the requested automation-eligible release proposals", async () => {
    getLegacyReleaseRepairCandidatesMock
      .mockResolvedValueOnce({
        results: [
          {
            blockingAlias: null,
            blockingParent: null,
            legacyBottle: createLegacyBottleMock({
              id: 11,
              fullName:
                "Elijah Craig Barrel Proof Kentucky Straight Bourbon (Batch C923)",
              edition: "Batch C923",
              totalTastings: 50,
            }),
            proposedParent: {
              id: 14,
              fullName: "Elijah Craig Barrel Proof",
              totalTastings: 180,
            },
            releaseIdentity: {
              edition: "Batch C923",
              releaseYear: null,
              markerSources: ["name_batch"],
            },
            siblingLegacyBottles: [],
            hasExactParent: false,
            repairMode: "existing_parent",
          },
        ],
        rel: {
          nextCursor: 2,
          prevCursor: null,
        },
      })
      .mockResolvedValueOnce({
        results: [
          {
            blockingAlias: null,
            blockingParent: null,
            legacyBottle: createLegacyBottleMock({
              id: 12,
              fullName: "Aberlour A'bunadh Batch 32",
              edition: "Batch 32",
              totalTastings: 12,
            }),
            proposedParent: {
              id: 13,
              fullName: "Aberlour A'bunadh",
              totalTastings: 200,
            },
            releaseIdentity: {
              edition: "Batch 32",
              releaseYear: null,
              markerSources: ["name_batch"],
            },
            siblingLegacyBottles: [],
            hasExactParent: true,
            repairMode: "existing_parent",
          },
        ],
        rel: {
          nextCursor: null,
          prevCursor: 1,
        },
      });

    const result = await getRepairBackfillProposals({
      onlyAutomationEligible: true,
      perTypeLimit: 1,
      types: ["release"],
    });

    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(1, {
      cursor: 1,
      limit: 1,
      query: "",
    });
    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(2, {
      cursor: 2,
      limit: 1,
      query: "",
    });
    expect(result.summary).toEqual({
      total: 1,
      automationEligible: 1,
      automationBlocked: 0,
      byType: {
        release: 1,
        age: 0,
        canon: 0,
      },
      byActionability: {
        apply: 1,
        blocked: 0,
        manual: 0,
      },
      byRepairMode: {
        release: {
          existing_parent: 1,
          create_parent: 0,
          blocked_alias_conflict: 0,
          blocked_dirty_parent: 0,
        },
        age: {
          existing_release: 0,
          create_release: 0,
        },
        canon: {
          review_required: 0,
        },
      },
    });
    expect(result.proposals).toEqual([
      expect.objectContaining({
        type: "release",
        bottle: expect.objectContaining({ id: 12 }),
        automationEligible: true,
      }),
    ]);
  });

  test("keeps a stable page size across cursor hops above the max page size", async () => {
    getLegacyReleaseRepairCandidatesMock
      .mockResolvedValueOnce({
        results: Array.from({ length: 100 }, (_, index) => ({
          blockingAlias: null,
          blockingParent: null,
          legacyBottle: createLegacyBottleMock({
            id: index + 1,
            fullName: `Release Repair ${index + 1}`,
            edition: `Batch ${index + 1}`,
            totalTastings: 500 - index,
          }),
          proposedParent: {
            id: 1000,
            fullName: "Release Repair",
            totalTastings: 1000,
          },
          releaseIdentity: {
            edition: `Batch ${index + 1}`,
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: true,
          repairMode: "existing_parent" as const,
        })),
        rel: {
          nextCursor: 2,
          prevCursor: null,
        },
      })
      .mockResolvedValueOnce({
        results: Array.from({ length: 100 }, (_, index) => ({
          blockingAlias: null,
          blockingParent: null,
          legacyBottle: createLegacyBottleMock({
            id: index + 101,
            fullName: `Release Repair ${index + 101}`,
            edition: `Batch ${index + 101}`,
            totalTastings: 400 - index,
          }),
          proposedParent: {
            id: 1000,
            fullName: "Release Repair",
            totalTastings: 1000,
          },
          releaseIdentity: {
            edition: `Batch ${index + 101}`,
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [],
          hasExactParent: true,
          repairMode: "existing_parent" as const,
        })),
        rel: {
          nextCursor: null,
          prevCursor: 1,
        },
      });

    const result = await getRepairBackfillProposals({
      perTypeLimit: 150,
      types: ["release"],
    });

    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(1, {
      cursor: 1,
      limit: 100,
      query: "",
    });
    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(2, {
      cursor: 2,
      limit: 100,
      query: "",
    });
    expect(result.summary.total).toBe(150);
    expect(result.proposals).toHaveLength(150);
    expect(result.proposals.at(-1)).toEqual(
      expect.objectContaining({
        type: "release",
        bottle: expect.objectContaining({
          id: 150,
        }),
      }),
    );
  });

  test("normalizes blocked release, existing-release age, and manual canon proposals together", async () => {
    getLegacyReleaseRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          blockingAlias: null,
          blockingParent: {
            id: 17,
            fullName: "Aberlour A'bunadh",
            totalTastings: 120,
          },
          legacyBottle: createLegacyBottleMock({
            id: 16,
            fullName: "Aberlour A'bunadh (Batch 4)",
            edition: "Batch 4",
            totalTastings: 6,
          }),
          proposedParent: {
            id: 17,
            fullName: "Aberlour A'bunadh",
            totalTastings: 120,
          },
          releaseIdentity: {
            edition: "Batch 4",
            releaseYear: null,
            markerSources: ["name_batch"],
          },
          siblingLegacyBottles: [
            {
              id: 15,
              fullName: "Aberlour A'bunadh (Batch 3)",
            },
          ],
          hasExactParent: true,
          repairMode: "blocked_dirty_parent",
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          bottle: createAgeBottleMock({
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
            name: "Rare Cask Release",
            statedAge: 40,
            numReleases: 2,
            totalTastings: 9,
          }),
          conflictingReleases: [
            {
              id: 22,
              fullName: "Glenglassaugh 1978 Rare Cask Release - Batch 1",
              statedAge: 35,
              totalTastings: 4,
            },
          ],
          repairMode: "existing_release",
          targetRelease: {
            id: 23,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
            statedAge: 40,
            totalTastings: 7,
          },
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    getCanonRepairCandidatesMock.mockResolvedValue({
      results: [
        {
          bottle: {
            id: 31,
            fullName: "Elijah Craig Barrel Proof Kentucky Straight Bourbon",
            numReleases: 0,
            totalTastings: 3,
          },
          targetBottle: {
            id: 32,
            fullName: "Elijah Craig Barrel Proof",
            numReleases: 5,
            totalTastings: 24,
          },
          variantBottles: [
            {
              id: 33,
              fullName: "Elijah Craig Barrel Proof Bourbon",
              numReleases: 0,
              totalTastings: 2,
            },
          ],
        },
      ],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });

    const result = await getRepairBackfillProposals({
      perTypeLimit: 5,
    });

    expect(result.summary).toEqual({
      total: 3,
      automationEligible: 1,
      automationBlocked: 2,
      byType: {
        release: 1,
        age: 1,
        canon: 1,
      },
      byActionability: {
        apply: 1,
        blocked: 1,
        manual: 1,
      },
      byRepairMode: {
        release: {
          existing_parent: 0,
          create_parent: 0,
          blocked_alias_conflict: 0,
          blocked_dirty_parent: 1,
        },
        age: {
          existing_release: 1,
          create_release: 0,
        },
        canon: {
          review_required: 1,
        },
      },
    });

    expect(result.proposals).toEqual(
      expect.arrayContaining<RepairBackfillProposal>([
        expect.objectContaining({
          type: "release",
          actionability: "blocked",
          repairMode: "blocked_dirty_parent",
          blockingParent: expect.objectContaining({
            id: 17,
            fullName: "Aberlour A'bunadh",
          }),
          siblingCount: 1,
          adminHref:
            "/admin/release-repairs?query=Aberlour%20A'bunadh%20(Batch%204)",
        }),
        expect.objectContaining({
          type: "age",
          actionability: "apply",
          repairMode: "existing_release",
          targetRelease: expect.objectContaining({
            id: 23,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
          }),
          conflictingReleaseCount: 1,
        }),
        expect.objectContaining({
          type: "canon",
          actionability: "manual",
          variantCount: 1,
          targetBottle: expect.objectContaining({
            id: 32,
            fullName: "Elijah Craig Barrel Proof",
          }),
        }),
      ]),
    );
  });
});
