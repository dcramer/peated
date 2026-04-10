import type { User } from "@peated/server/db/schema";
import {
  applyDirtyParentAgeRepair,
  DirtyParentAgeRepairBadRequestError,
} from "@peated/server/lib/applyDirtyParentAgeRepair";
import {
  applyLegacyReleaseRepair,
  LegacyReleaseRepairBadRequestError,
} from "@peated/server/lib/applyLegacyReleaseRepair";
import {
  getDirtyParentAgeRepairCandidates,
  type DirtyParentAgeRepairCandidate,
} from "@peated/server/lib/dirtyParentAgeRepairCandidates";
import {
  getLegacyReleaseRepairCandidates,
  type LegacyReleaseRepairCandidate,
} from "@peated/server/lib/legacyReleaseRepairCandidates";

const MAX_PAGE_SIZE = 100;

export type BatchApplicableRepairBackfillProposalType = "age" | "release";

export type ApplyRepairBackfillProposalItem = {
  action:
    | "apply_age_repair"
    | "apply_release_repair"
    | "preview_age_repair"
    | "preview_release_repair";
  bottleId: number;
  bottleName: string;
  message: string;
  releaseId: number | null;
  status: "applied" | "failed" | "planned";
  type: BatchApplicableRepairBackfillProposalType;
};

export type ApplyRepairBackfillProposalsResult = {
  items: ApplyRepairBackfillProposalItem[];
  summary: {
    applied: number;
    failed: number;
    planned: number;
    total: number;
  };
};

type BatchApplicableReleaseRepairProposal = {
  bottle: {
    fullName: string;
    id: number;
  };
  proposedParent: {
    fullName: string;
  };
  repairMode: "create_parent" | "existing_parent";
  type: "release";
};

type BatchApplicableAgeRepairProposal = {
  bottle: {
    fullName: string;
    id: number;
  };
  repairMode: "create_release" | "existing_release";
  targetRelease: {
    fullName: string;
    id: number | null;
  };
  type: "age";
};

type BatchApplicableRepairProposal =
  | BatchApplicableAgeRepairProposal
  | BatchApplicableReleaseRepairProposal;

type CandidatePage<TCandidate> = {
  rel: {
    nextCursor: null | number;
    prevCursor: null | number;
  };
  results: TCandidate[];
};

function createResultSummary(items: ApplyRepairBackfillProposalItem[]) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      return summary;
    },
    {
      total: 0,
      planned: 0,
      applied: 0,
      failed: 0,
    },
  );
}

function createDryRunItem(
  proposal: BatchApplicableRepairProposal,
): ApplyRepairBackfillProposalItem {
  if (proposal.type === "release") {
    return {
      type: proposal.type,
      status: "planned",
      action: "preview_release_repair",
      bottleId: proposal.bottle.id,
      bottleName: proposal.bottle.fullName,
      releaseId: null,
      message: `Would move ${proposal.bottle.fullName} under ${proposal.proposedParent.fullName}.`,
    };
  }

  return {
    type: proposal.type,
    status: "planned",
    action: "preview_age_repair",
    bottleId: proposal.bottle.id,
    bottleName: proposal.bottle.fullName,
    releaseId: proposal.targetRelease.id,
    message:
      proposal.repairMode === "create_release"
        ? `Would create ${proposal.targetRelease.fullName} from ${proposal.bottle.fullName}.`
        : `Would move ${proposal.bottle.fullName} into ${proposal.targetRelease.fullName}.`,
  };
}

async function applyRepairBackfillProposal(
  proposal: BatchApplicableRepairProposal,
  user: User,
): Promise<ApplyRepairBackfillProposalItem> {
  try {
    if (proposal.type === "release") {
      const result = await applyLegacyReleaseRepair({
        legacyBottleId: proposal.bottle.id,
        user,
      });

      return {
        type: proposal.type,
        status: "applied",
        action: "apply_release_repair",
        bottleId: proposal.bottle.id,
        bottleName: proposal.bottle.fullName,
        releaseId: result.releaseId,
        message: `Moved ${proposal.bottle.fullName} under ${proposal.proposedParent.fullName}.`,
      };
    }

    const result = await applyDirtyParentAgeRepair({
      bottleId: proposal.bottle.id,
      user,
    });

    return {
      type: proposal.type,
      status: "applied",
      action: "apply_age_repair",
      bottleId: proposal.bottle.id,
      bottleName: proposal.bottle.fullName,
      releaseId: result.releaseId,
      message:
        proposal.repairMode === "create_release"
          ? `Created ${proposal.targetRelease.fullName} from ${proposal.bottle.fullName}.`
          : `Moved ${proposal.bottle.fullName} into ${proposal.targetRelease.fullName}.`,
    };
  } catch (err) {
    if (
      err instanceof LegacyReleaseRepairBadRequestError ||
      err instanceof DirtyParentAgeRepairBadRequestError ||
      err instanceof Error
    ) {
      return {
        type: proposal.type,
        status: "failed",
        action:
          proposal.type === "release"
            ? "apply_release_repair"
            : "apply_age_repair",
        bottleId: proposal.bottle.id,
        bottleName: proposal.bottle.fullName,
        releaseId: null,
        message: err.message,
      };
    }

    throw err;
  }
}

function isActionableReleaseRepairCandidate(
  candidate: LegacyReleaseRepairCandidate,
): candidate is LegacyReleaseRepairCandidate & {
  repairMode: "create_parent" | "existing_parent";
} {
  return (
    candidate.repairMode === "create_parent" ||
    candidate.repairMode === "existing_parent"
  );
}

function toApplicableReleaseRepairProposal(
  candidate: LegacyReleaseRepairCandidate & {
    repairMode: "create_parent" | "existing_parent";
  },
): BatchApplicableReleaseRepairProposal {
  return {
    type: "release",
    bottle: {
      id: candidate.legacyBottle.id,
      fullName: candidate.legacyBottle.fullName,
    },
    proposedParent: {
      fullName: candidate.proposedParent.fullName,
    },
    repairMode: candidate.repairMode,
  };
}

function toApplicableAgeRepairProposal(
  candidate: DirtyParentAgeRepairCandidate,
): BatchApplicableAgeRepairProposal {
  return {
    type: "age",
    bottle: {
      id: candidate.bottle.id,
      fullName: candidate.bottle.fullName,
    },
    repairMode: candidate.repairMode,
    targetRelease: {
      id: candidate.targetRelease.id,
      fullName: candidate.targetRelease.fullName,
    },
  };
}

async function collectApplicableRepairCandidates<TCandidate, TProposal>({
  fetcher,
  isApplicable,
  map,
  perTypeLimit,
  query,
}: {
  fetcher: (args: {
    cursor: number;
    limit: number;
    query: string;
  }) => Promise<CandidatePage<TCandidate>>;
  isApplicable: (candidate: TCandidate) => boolean;
  map: (candidate: TCandidate) => TProposal;
  perTypeLimit: number;
  query: string;
}) {
  const proposals: TProposal[] = [];
  const pageSize = Math.min(MAX_PAGE_SIZE, perTypeLimit);
  let cursor = 1;

  while (proposals.length < perTypeLimit) {
    const page = await fetcher({
      cursor,
      limit: pageSize,
      query,
    });

    for (const candidate of page.results) {
      if (!isApplicable(candidate)) {
        continue;
      }

      proposals.push(map(candidate));
      if (proposals.length >= perTypeLimit) {
        break;
      }
    }

    if (!page.rel.nextCursor || page.results.length === 0) {
      break;
    }

    cursor = page.rel.nextCursor;
  }

  return proposals;
}

async function collectApplicableReleaseRepairProposals({
  perTypeLimit,
  query,
}: {
  perTypeLimit: number;
  query: string;
}) {
  return collectApplicableRepairCandidates({
    fetcher: getLegacyReleaseRepairCandidates,
    isApplicable: isActionableReleaseRepairCandidate,
    map: (candidate) =>
      toApplicableReleaseRepairProposal(
        candidate as LegacyReleaseRepairCandidate & {
          repairMode: "create_parent" | "existing_parent";
        },
      ),
    perTypeLimit,
    query,
  });
}

async function collectApplicableAgeRepairProposals({
  perTypeLimit,
  query,
}: {
  perTypeLimit: number;
  query: string;
}) {
  return collectApplicableRepairCandidates({
    fetcher: getDirtyParentAgeRepairCandidates,
    isApplicable: () => true,
    map: toApplicableAgeRepairProposal,
    perTypeLimit,
    query,
  });
}

export async function applyRepairBackfillProposals({
  dryRun = true,
  perTypeLimit = 100,
  query = "",
  types = ["release", "age"],
  user,
}: {
  dryRun?: boolean;
  perTypeLimit?: number;
  query?: string;
  types?: BatchApplicableRepairBackfillProposalType[];
  user?: User;
}): Promise<ApplyRepairBackfillProposalsResult> {
  const normalizedTypes = Array.from(new Set(types));

  if (!dryRun && !user) {
    throw new Error(
      "Automation moderator user is required to execute repair proposals.",
    );
  }

  const executionUser = user;
  const items: ApplyRepairBackfillProposalItem[] = [];

  if (normalizedTypes.includes("release")) {
    const releaseProposals = await collectApplicableReleaseRepairProposals({
      perTypeLimit,
      query,
    });

    for (const proposal of releaseProposals) {
      if (dryRun) {
        items.push(createDryRunItem(proposal));
        continue;
      }

      items.push(await applyRepairBackfillProposal(proposal, executionUser!));
    }
  }

  if (normalizedTypes.includes("age")) {
    const ageProposals = await collectApplicableAgeRepairProposals({
      perTypeLimit,
      query,
    });

    for (const proposal of ageProposals) {
      if (dryRun) {
        items.push(createDryRunItem(proposal));
        continue;
      }

      items.push(await applyRepairBackfillProposal(proposal, executionUser!));
    }
  }

  return {
    items,
    summary: createResultSummary(items),
  };
}
