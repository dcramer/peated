import { beforeEach, describe, expect, test, vi } from "vitest";

import { applyDirtyParentAgeRepair } from "@peated/server/lib/applyDirtyParentAgeRepair";
import { applyLegacyReleaseRepair } from "@peated/server/lib/applyLegacyReleaseRepair";
import { applyRepairBackfillProposals } from "@peated/server/lib/applyRepairBackfillProposals";
import { getDirtyParentAgeRepairCandidates } from "@peated/server/lib/dirtyParentAgeRepairCandidates";
import { getLegacyReleaseRepairCandidates } from "@peated/server/lib/legacyReleaseRepairCandidates";

vi.mock("@peated/server/lib/legacyReleaseRepairCandidates", () => ({
  getLegacyReleaseRepairCandidates: vi.fn(),
}));

vi.mock("@peated/server/lib/dirtyParentAgeRepairCandidates", () => ({
  getDirtyParentAgeRepairCandidates: vi.fn(),
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
});
