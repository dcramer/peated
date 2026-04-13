import { beforeEach, describe, expect, test, vi } from "vitest";

import { applyDirtyParentAgeRepair } from "@peated/server/lib/applyDirtyParentAgeRepair";
import { applyLegacyReleaseRepair } from "@peated/server/lib/applyLegacyReleaseRepair";
import { applyRepairBackfillProposals } from "@peated/server/lib/applyRepairBackfillProposals";
import { getDirtyParentAgeRepairCandidates } from "@peated/server/lib/dirtyParentAgeRepairCandidates";
import { getLegacyReleaseRepairCandidates } from "@peated/server/lib/legacyReleaseRepairCandidates";
import { refreshLegacyReleaseRepairReview } from "@peated/server/lib/legacyReleaseRepairReviews";

vi.mock("@peated/server/lib/legacyReleaseRepairCandidates", () => ({
  getLegacyReleaseRepairCandidates: vi.fn(),
}));

vi.mock("@peated/server/lib/dirtyParentAgeRepairCandidates", () => ({
  getDirtyParentAgeRepairCandidates: vi.fn(),
}));

vi.mock("@peated/server/lib/legacyReleaseRepairReviews", () => ({
  refreshLegacyReleaseRepairReview: vi.fn(),
}));

vi.mock("@peated/server/lib/applyLegacyReleaseRepair", () => ({
  LegacyReleaseRepairBadRequestError: class LegacyReleaseRepairBadRequestError extends Error {},
  applyLegacyReleaseRepair: vi.fn(),
}));

vi.mock("@peated/server/lib/applyDirtyParentAgeRepair", () => ({
  DirtyParentAgeRepairBadRequestError: class DirtyParentAgeRepairBadRequestError extends Error {},
  applyDirtyParentAgeRepair: vi.fn(),
}));

const getLegacyReleaseRepairCandidatesMock = vi.mocked(
  getLegacyReleaseRepairCandidates,
);
const getDirtyParentAgeRepairCandidatesMock = vi.mocked(
  getDirtyParentAgeRepairCandidates,
);
const refreshLegacyReleaseRepairReviewMock = vi.mocked(
  refreshLegacyReleaseRepairReview,
);
const applyLegacyReleaseRepairMock = vi.mocked(applyLegacyReleaseRepair);
const applyDirtyParentAgeRepairMock = vi.mocked(applyDirtyParentAgeRepair);

const user = {
  id: 1,
  mod: true,
  admin: true,
} as any;

describe("applyRepairBackfillProposals", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    refreshLegacyReleaseRepairReviewMock.mockResolvedValue(null);
  });

  test("previews actionable release repairs across multiple pages without requiring a user", async () => {
    getLegacyReleaseRepairCandidatesMock
      .mockResolvedValueOnce({
        rel: {
          nextCursor: 2,
          prevCursor: null,
        },
        results: [
          {
            legacyBottle: {
              id: 11,
              fullName: "Aberlour A'bunadh (Batch 32)",
            },
            proposedParent: {
              id: 12,
              fullName: "Aberlour A'bunadh",
              totalTastings: 100,
            },
            repairMode: "blocked_alias_conflict",
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        rel: {
          nextCursor: 3,
          prevCursor: 1,
        },
        results: [
          {
            legacyBottle: {
              id: 13,
              fullName: "Aberlour A'bunadh (Batch 33)",
            },
            proposedParent: {
              id: 12,
              fullName: "Aberlour A'bunadh",
              totalTastings: 100,
            },
            repairMode: "blocked_dirty_parent",
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        rel: {
          nextCursor: null,
          prevCursor: 2,
        },
        results: [
          {
            legacyBottle: {
              id: 14,
              fullName: "Aberlour A'bunadh (Batch 34)",
            },
            proposedParent: {
              id: 12,
              fullName: "Aberlour A'bunadh",
              totalTastings: 100,
            },
            repairMode: "existing_parent",
          },
        ],
      } as any);
    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
      results: [],
    } as any);

    const result = await applyRepairBackfillProposals({
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
    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(3, {
      cursor: 3,
      limit: 1,
      query: "",
    });
    expect(applyLegacyReleaseRepairMock).not.toHaveBeenCalled();
    expect(result.summary).toEqual({
      total: 1,
      planned: 1,
      applied: 0,
      failed: 0,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        type: "release",
        status: "planned",
        action: "preview_release_repair",
        bottleId: 14,
      }),
    ]);
  });

  test("applies proposals and reports mixed success and failure", async () => {
    getLegacyReleaseRepairCandidatesMock.mockResolvedValue({
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
      results: [
        {
          legacyBottle: {
            id: 11,
            fullName: "Aberlour A'bunadh (Batch 32)",
          },
          proposedParent: {
            id: 12,
            fullName: "Aberlour A'bunadh",
            totalTastings: 100,
          },
          repairMode: "existing_parent",
        },
      ],
    } as any);
    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
      results: [
        {
          bottle: {
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
          },
          repairMode: "existing_release",
          targetRelease: {
            id: 22,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
          },
        },
      ],
    } as any);
    applyLegacyReleaseRepairMock.mockResolvedValue({
      legacyBottleId: 11,
      parentBottleId: 12,
      releaseId: 13,
      aliasNames: [],
    });
    applyDirtyParentAgeRepairMock.mockRejectedValue(
      new Error(
        "Bottle markets its statedAge in the name and cannot use dirty parent age repair.",
      ),
    );

    const result = await applyRepairBackfillProposals({
      dryRun: false,
      perTypeLimit: 50,
      query: "Rare",
      types: ["age", "release"],
      user,
    });

    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenCalledWith({
      cursor: 1,
      limit: 50,
      query: "Rare",
    });
    expect(getDirtyParentAgeRepairCandidatesMock).toHaveBeenCalledWith({
      cursor: 1,
      limit: 50,
      query: "Rare",
    });
    expect(applyLegacyReleaseRepairMock).toHaveBeenCalledWith({
      legacyBottleId: 11,
      user,
    });
    expect(applyDirtyParentAgeRepairMock).toHaveBeenCalledWith({
      bottleId: 21,
      user,
    });
    expect(result.summary).toEqual({
      total: 2,
      planned: 0,
      applied: 1,
      failed: 1,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        type: "release",
        status: "applied",
        action: "apply_release_repair",
        releaseId: 13,
      }),
      expect.objectContaining({
        type: "age",
        status: "failed",
        action: "apply_age_repair",
        message:
          "Bottle markets its statedAge in the name and cannot use dirty parent age repair.",
      }),
    ]);
  });

  test("rescans age repairs after applying release repairs during execution", async () => {
    getLegacyReleaseRepairCandidatesMock.mockResolvedValue({
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
      results: [
        {
          legacyBottle: {
            id: 11,
            fullName: "Dirty Legacy Release 10-year-old",
          },
          proposedParent: {
            id: 12,
            fullName: "Dirty Legacy Parent",
            totalTastings: 100,
          },
          repairMode: "existing_parent",
        },
      ],
    } as any);
    getDirtyParentAgeRepairCandidatesMock.mockImplementation(async () => {
      expect(applyLegacyReleaseRepairMock).toHaveBeenCalledWith({
        legacyBottleId: 11,
        user,
      });

      return {
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
        results: [
          {
            bottle: {
              id: 12,
              fullName: "Dirty Legacy Parent",
            },
            repairMode: "create_release",
            targetRelease: {
              id: null,
              fullName: "Dirty Legacy Parent 12-year-old",
            },
          },
        ],
      } as any;
    });
    applyLegacyReleaseRepairMock.mockResolvedValue({
      legacyBottleId: 11,
      parentBottleId: 12,
      releaseId: 13,
      aliasNames: [],
    });
    applyDirtyParentAgeRepairMock.mockResolvedValue({
      bottleId: 12,
      releaseId: 14,
    } as any);

    const result = await applyRepairBackfillProposals({
      dryRun: false,
      perTypeLimit: 10,
      types: ["release", "age"],
      user,
    });

    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenCalledTimes(1);
    expect(getDirtyParentAgeRepairCandidatesMock).toHaveBeenCalledTimes(1);
    expect(
      applyLegacyReleaseRepairMock.mock.invocationCallOrder[0],
    ).toBeLessThan(
      getDirtyParentAgeRepairCandidatesMock.mock.invocationCallOrder[0]!,
    );
    expect(applyDirtyParentAgeRepairMock).toHaveBeenCalledWith({
      bottleId: 12,
      user,
    });
    expect(result.summary).toEqual({
      total: 2,
      planned: 0,
      applied: 2,
      failed: 0,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        type: "release",
        status: "applied",
        action: "apply_release_repair",
        bottleId: 11,
        releaseId: 13,
      }),
      expect.objectContaining({
        type: "age",
        status: "applied",
        action: "apply_age_repair",
        bottleId: 12,
        releaseId: 14,
      }),
    ]);
  });

  test("can restrict preview and execution to the unattended-safe subset", async () => {
    getLegacyReleaseRepairCandidatesMock.mockResolvedValue({
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
      results: [
        {
          legacyBottle: {
            id: 11,
            fullName: "Aberlour A'bunadh (Batch 32)",
          },
          proposedParent: {
            id: 12,
            fullName: "Aberlour A'bunadh",
            totalTastings: 100,
          },
          hasExactParent: true,
          parentResolutionSource: "heuristic_exact",
          repairMode: "existing_parent",
        },
        {
          legacyBottle: {
            id: 13,
            fullName:
              "Elijah Craig Barrel Proof Kentucky Straight Bourbon (Batch C923)",
          },
          proposedParent: {
            id: 14,
            fullName: "Elijah Craig Barrel Proof",
            totalTastings: 100,
          },
          hasExactParent: false,
          parentResolutionSource: "classifier_review_persisted",
          repairMode: "existing_parent",
        },
      ],
    } as any);
    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
      results: [
        {
          bottle: {
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
          },
          repairMode: "existing_release",
          targetRelease: {
            id: 22,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
          },
        },
        {
          bottle: {
            id: 23,
            fullName: "Another Dirty Parent",
          },
          repairMode: "create_release",
          targetRelease: {
            id: null,
            fullName: "Another Dirty Parent 18-year-old",
          },
        },
      ],
    } as any);
    applyLegacyReleaseRepairMock.mockResolvedValue({
      legacyBottleId: 11,
      parentBottleId: 12,
      releaseId: 31,
      aliasNames: [],
    });
    applyDirtyParentAgeRepairMock.mockResolvedValue({
      bottleId: 21,
      releaseId: 22,
    } as any);

    const preview = await applyRepairBackfillProposals({
      automationOnly: true,
      perTypeLimit: 10,
      types: ["release", "age"],
    });

    expect(preview.summary).toEqual({
      total: 3,
      planned: 3,
      applied: 0,
      failed: 0,
    });
    expect(preview.items).toEqual([
      expect.objectContaining({
        type: "release",
        bottleId: 11,
        status: "planned",
      }),
      expect.objectContaining({
        type: "release",
        bottleId: 13,
        status: "planned",
      }),
      expect.objectContaining({
        type: "age",
        bottleId: 21,
        status: "planned",
      }),
    ]);

    const execution = await applyRepairBackfillProposals({
      automationOnly: true,
      dryRun: false,
      perTypeLimit: 10,
      types: ["release", "age"],
      user,
    });

    expect(applyLegacyReleaseRepairMock).toHaveBeenCalledTimes(2);
    expect(applyLegacyReleaseRepairMock).toHaveBeenNthCalledWith(1, {
      legacyBottleId: 11,
      user,
    });
    expect(applyLegacyReleaseRepairMock).toHaveBeenNthCalledWith(2, {
      legacyBottleId: 13,
      user,
    });
    expect(applyDirtyParentAgeRepairMock).toHaveBeenCalledTimes(1);
    expect(applyDirtyParentAgeRepairMock).toHaveBeenCalledWith({
      bottleId: 21,
      user,
    });
    expect(execution.summary).toEqual({
      total: 3,
      planned: 0,
      applied: 3,
      failed: 0,
    });
    expect(execution.items).toEqual([
      expect.objectContaining({
        type: "release",
        bottleId: 11,
        status: "applied",
        releaseId: 31,
      }),
      expect.objectContaining({
        type: "release",
        bottleId: 13,
        status: "applied",
      }),
      expect.objectContaining({
        type: "age",
        bottleId: 21,
        status: "applied",
        releaseId: 22,
      }),
    ]);
  });

  test("can refresh release reviews before collecting automation-safe release proposals", async () => {
    getLegacyReleaseRepairCandidatesMock
      .mockResolvedValueOnce({
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
        results: [
          {
            legacyBottle: {
              id: 13,
              fullName:
                "Elijah Craig Barrel Proof Kentucky Straight Bourbon (Batch C923)",
            },
            proposedParent: {
              id: null,
              fullName: "Elijah Craig Barrel Proof",
              totalTastings: null,
            },
            parentResolutionSource: null,
            repairMode: "create_parent",
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
        results: [
          {
            legacyBottle: {
              id: 13,
              fullName:
                "Elijah Craig Barrel Proof Kentucky Straight Bourbon (Batch C923)",
            },
            proposedParent: {
              id: 14,
              fullName: "Elijah Craig Barrel Proof",
              totalTastings: 100,
            },
            hasExactParent: false,
            parentResolutionSource: "classifier_review_persisted",
            repairMode: "existing_parent",
          },
        ],
      } as any);
    getDirtyParentAgeRepairCandidatesMock.mockResolvedValue({
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
      results: [],
    } as any);

    const result = await applyRepairBackfillProposals({
      automationOnly: true,
      perTypeLimit: 10,
      refreshReleaseReviews: true,
      types: ["release"],
    });

    expect(refreshLegacyReleaseRepairReviewMock).toHaveBeenCalledTimes(1);
    expect(refreshLegacyReleaseRepairReviewMock).toHaveBeenCalledWith({
      legacyBottleId: 13,
    });
    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(1, {
      cursor: 1,
      limit: 10,
      query: "",
    });
    expect(getLegacyReleaseRepairCandidatesMock).toHaveBeenNthCalledWith(2, {
      cursor: 1,
      limit: 10,
      query: "",
    });
    expect(result.summary).toEqual({
      total: 1,
      planned: 1,
      applied: 0,
      failed: 0,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        type: "release",
        bottleId: 13,
        status: "planned",
      }),
    ]);
  });
});
