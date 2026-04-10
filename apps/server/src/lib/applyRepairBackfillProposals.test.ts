import { beforeEach, describe, expect, test, vi } from "vitest";

import { applyDirtyParentAgeRepair } from "@peated/server/lib/applyDirtyParentAgeRepair";
import { applyLegacyReleaseRepair } from "@peated/server/lib/applyLegacyReleaseRepair";
import { applyRepairBackfillProposals } from "@peated/server/lib/applyRepairBackfillProposals";
import { getRepairBackfillProposals } from "@peated/server/lib/repairBackfillProposals";

vi.mock("@peated/server/lib/repairBackfillProposals", () => ({
  getRepairBackfillProposals: vi.fn(),
}));

vi.mock("@peated/server/lib/applyLegacyReleaseRepair", () => ({
  LegacyReleaseRepairBadRequestError: class LegacyReleaseRepairBadRequestError extends Error {},
  applyLegacyReleaseRepair: vi.fn(),
}));

vi.mock("@peated/server/lib/applyDirtyParentAgeRepair", () => ({
  DirtyParentAgeRepairBadRequestError: class DirtyParentAgeRepairBadRequestError extends Error {},
  applyDirtyParentAgeRepair: vi.fn(),
}));

const getRepairBackfillProposalsMock = vi.mocked(getRepairBackfillProposals);
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

  test("previews directly actionable release and age proposals without mutating", async () => {
    getRepairBackfillProposalsMock.mockResolvedValue({
      proposals: [
        {
          type: "release",
          actionability: "apply",
          adminHref: "/admin/release-repairs?query=Aberlour",
          bottle: {
            id: 11,
            fullName: "Aberlour A'bunadh Batch 32",
            totalTastings: 10,
          },
          blockingAlias: null,
          blockingParent: null,
          proposedParent: {
            id: 12,
            fullName: "Aberlour A'bunadh",
            totalTastings: 100,
          },
          releaseIdentity: {
            edition: "Batch 32",
            markerSources: ["name_batch"],
            releaseYear: null,
          },
          repairMode: "existing_parent",
          siblingCount: 2,
          totalTastings: 10,
        },
        {
          type: "age",
          actionability: "apply",
          adminHref: "/admin/age-repairs?query=Glenglassaugh",
          bottle: {
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
            statedAge: 40,
            totalTastings: 9,
          },
          conflictingReleaseCount: 1,
          repairMode: "create_release",
          targetRelease: {
            id: null,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
            statedAge: 40,
            totalTastings: null,
          },
          totalTastings: 9,
        },
        {
          type: "canon",
          actionability: "manual",
          adminHref: "/admin/canon-repairs?query=Elijah",
          bottle: {
            id: 31,
            fullName: "Elijah Craig Barrel Proof Kentucky Straight Bourbon",
            totalTastings: 3,
          },
          targetBottle: {
            id: 32,
            fullName: "Elijah Craig Barrel Proof",
            totalTastings: 24,
          },
          totalTastings: 3,
          variantCount: 0,
        },
      ],
      summary: {
        total: 3,
        byType: {
          release: 1,
          age: 1,
          canon: 1,
        },
        byActionability: {
          apply: 2,
          blocked: 0,
          manual: 1,
        },
      },
    });

    const result = await applyRepairBackfillProposals({
      user,
    });

    expect(getRepairBackfillProposalsMock).toHaveBeenCalledWith({
      onlyActionable: true,
      perTypeLimit: 100,
      query: "",
      types: ["release", "age"],
    });
    expect(applyLegacyReleaseRepairMock).not.toHaveBeenCalled();
    expect(applyDirtyParentAgeRepairMock).not.toHaveBeenCalled();
    expect(result.summary).toEqual({
      total: 2,
      planned: 2,
      applied: 0,
      failed: 0,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        status: "planned",
        action: "preview_release_repair",
        bottleId: 11,
      }),
      expect.objectContaining({
        status: "planned",
        action: "preview_age_repair",
        bottleId: 21,
      }),
    ]);
  });

  test("applies proposals and reports mixed success and failure", async () => {
    getRepairBackfillProposalsMock.mockResolvedValue({
      proposals: [
        {
          type: "release",
          actionability: "apply",
          adminHref: "/admin/release-repairs?query=Aberlour",
          bottle: {
            id: 11,
            fullName: "Aberlour A'bunadh Batch 32",
            totalTastings: 10,
          },
          blockingAlias: null,
          blockingParent: null,
          proposedParent: {
            id: 12,
            fullName: "Aberlour A'bunadh",
            totalTastings: 100,
          },
          releaseIdentity: {
            edition: "Batch 32",
            markerSources: ["name_batch"],
            releaseYear: null,
          },
          repairMode: "existing_parent",
          siblingCount: 2,
          totalTastings: 10,
        },
        {
          type: "age",
          actionability: "apply",
          adminHref: "/admin/age-repairs?query=Glenglassaugh",
          bottle: {
            id: 21,
            fullName: "Glenglassaugh 1978 Rare Cask Release",
            statedAge: 40,
            totalTastings: 9,
          },
          conflictingReleaseCount: 1,
          repairMode: "existing_release",
          targetRelease: {
            id: 22,
            fullName: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
            statedAge: 40,
            totalTastings: 2,
          },
          totalTastings: 9,
        },
      ],
      summary: {
        total: 2,
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
      },
    });
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

    expect(getRepairBackfillProposalsMock).toHaveBeenCalledWith({
      onlyActionable: true,
      perTypeLimit: 50,
      query: "Rare",
      types: ["age", "release"],
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
        status: "applied",
        action: "apply_release_repair",
        releaseId: 13,
      }),
      expect.objectContaining({
        status: "failed",
        action: "apply_age_repair",
        message:
          "Bottle markets its statedAge in the name and cannot use dirty parent age repair.",
      }),
    ]);
  });
});
