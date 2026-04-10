import {
  getCanonRepairCandidates,
  type CanonRepairCandidate,
} from "@peated/server/lib/canonRepairCandidates";
import {
  getDirtyParentAgeRepairCandidates,
  type DirtyParentAgeRepairCandidate,
} from "@peated/server/lib/dirtyParentAgeRepairCandidates";
import {
  getLegacyReleaseRepairCandidates,
  type LegacyReleaseRepairCandidate,
  type LegacyReleaseRepairParentMode,
} from "@peated/server/lib/legacyReleaseRepairCandidates";

const DEFAULT_PER_TYPE_LIMIT = 100;
const MAX_PAGE_SIZE = 100;

export type RepairBackfillProposalType = "age" | "canon" | "release";
export type RepairBackfillProposalActionability =
  | "apply"
  | "blocked"
  | "manual";

type RepairBackfillProposalSummary = {
  byActionability: Record<RepairBackfillProposalActionability, number>;
  byType: Record<RepairBackfillProposalType, number>;
  total: number;
};

type RepairBackfillCandidatePage<TCandidate> = {
  rel: {
    nextCursor: null | number;
    prevCursor: null | number;
  };
  results: TCandidate[];
};

type RepairBackfillProposalBase = {
  actionability: RepairBackfillProposalActionability;
  adminHref: string;
  totalTastings: null | number;
  type: RepairBackfillProposalType;
};

export type ReleaseRepairBackfillProposal = RepairBackfillProposalBase & {
  actionability: "apply" | "blocked";
  bottle: {
    fullName: string;
    id: number;
    totalTastings: null | number;
  };
  blockingAlias: null | {
    bottleFullName: string | null;
    bottleId: number | null;
    name: string;
    releaseFullName: string | null;
    releaseId: number | null;
  };
  blockingParent: null | {
    fullName: string;
    id: number;
    totalTastings: null | number;
  };
  proposedParent: {
    fullName: string;
    id: number | null;
    totalTastings: null | number;
  };
  releaseIdentity: {
    edition: null | string;
    markerSources: string[];
    releaseYear: null | number;
  };
  repairMode: LegacyReleaseRepairParentMode;
  siblingCount: number;
  type: "release";
};

export type AgeRepairBackfillProposal = RepairBackfillProposalBase & {
  actionability: "apply";
  bottle: {
    fullName: string;
    id: number;
    statedAge: number;
    totalTastings: null | number;
  };
  conflictingReleaseCount: number;
  repairMode: "create_release" | "existing_release";
  targetRelease: {
    fullName: string;
    id: number | null;
    statedAge: number;
    totalTastings: null | number;
  };
  type: "age";
};

export type CanonRepairBackfillProposal = RepairBackfillProposalBase & {
  actionability: "manual";
  bottle: {
    fullName: string;
    id: number;
    totalTastings: null | number;
  };
  targetBottle: {
    fullName: string;
    id: number;
    totalTastings: null | number;
  };
  type: "canon";
  variantCount: number;
};

export type RepairBackfillProposal =
  | AgeRepairBackfillProposal
  | CanonRepairBackfillProposal
  | ReleaseRepairBackfillProposal;

export type RepairBackfillProposalResult = {
  proposals: RepairBackfillProposal[];
  summary: RepairBackfillProposalSummary;
};

function buildAdminHref(pathname: string, query: string) {
  return `${pathname}?query=${encodeURIComponent(query)}`;
}

function getProposalTastingCount(proposal: RepairBackfillProposal) {
  return proposal.totalTastings ?? 0;
}

function getRepairBackfillProposalActionability(
  repairMode: LegacyReleaseRepairParentMode,
): "apply" | "blocked" {
  return repairMode === "existing_parent" || repairMode === "create_parent"
    ? "apply"
    : "blocked";
}

async function collectRepairCandidates<TCandidate>({
  fetcher,
  perTypeLimit,
  query,
}: {
  fetcher: (args: {
    cursor: number;
    limit: number;
    query: string;
  }) => Promise<RepairBackfillCandidatePage<TCandidate>>;
  perTypeLimit: number;
  query: string;
}) {
  const results: TCandidate[] = [];
  const pageSize = Math.min(MAX_PAGE_SIZE, perTypeLimit);
  let cursor = 1;

  while (results.length < perTypeLimit) {
    const page = await fetcher({
      cursor,
      limit: pageSize,
      query,
    });

    results.push(...page.results);

    if (!page.rel.nextCursor || page.results.length === 0) {
      break;
    }

    cursor = page.rel.nextCursor;
  }

  return results.slice(0, perTypeLimit);
}

function toReleaseRepairBackfillProposal(
  candidate: LegacyReleaseRepairCandidate,
): ReleaseRepairBackfillProposal {
  return {
    type: "release",
    actionability: getRepairBackfillProposalActionability(candidate.repairMode),
    adminHref: buildAdminHref(
      "/admin/release-repairs",
      candidate.legacyBottle.fullName,
    ),
    bottle: {
      id: candidate.legacyBottle.id,
      fullName: candidate.legacyBottle.fullName,
      totalTastings: candidate.legacyBottle.totalTastings,
    },
    blockingAlias: candidate.blockingAlias,
    blockingParent: candidate.blockingParent,
    proposedParent: candidate.proposedParent,
    releaseIdentity: candidate.releaseIdentity,
    repairMode: candidate.repairMode,
    siblingCount: candidate.siblingLegacyBottles.length,
    totalTastings: candidate.legacyBottle.totalTastings,
  };
}

function toAgeRepairBackfillProposal(
  candidate: DirtyParentAgeRepairCandidate,
): AgeRepairBackfillProposal {
  return {
    type: "age",
    actionability: "apply",
    adminHref: buildAdminHref("/admin/age-repairs", candidate.bottle.fullName),
    bottle: {
      id: candidate.bottle.id,
      fullName: candidate.bottle.fullName,
      statedAge: candidate.bottle.statedAge,
      totalTastings: candidate.bottle.totalTastings,
    },
    conflictingReleaseCount: candidate.conflictingReleases.length,
    repairMode: candidate.repairMode,
    targetRelease: candidate.targetRelease,
    totalTastings: candidate.bottle.totalTastings,
  };
}

function toCanonRepairBackfillProposal(
  candidate: CanonRepairCandidate,
): CanonRepairBackfillProposal {
  return {
    type: "canon",
    actionability: "manual",
    adminHref: buildAdminHref(
      "/admin/canon-repairs",
      candidate.bottle.fullName,
    ),
    bottle: candidate.bottle,
    targetBottle: candidate.targetBottle,
    totalTastings: candidate.bottle.totalTastings,
    variantCount: candidate.variantBottles.length,
  };
}

function createRepairBackfillProposalSummary(
  proposals: RepairBackfillProposal[],
): RepairBackfillProposalSummary {
  return proposals.reduce<RepairBackfillProposalSummary>(
    (summary, proposal) => {
      summary.total += 1;
      summary.byType[proposal.type] += 1;
      summary.byActionability[proposal.actionability] += 1;
      return summary;
    },
    {
      total: 0,
      byType: {
        release: 0,
        age: 0,
        canon: 0,
      },
      byActionability: {
        apply: 0,
        blocked: 0,
        manual: 0,
      },
    },
  );
}

export async function getRepairBackfillProposals({
  onlyActionable = false,
  perTypeLimit = DEFAULT_PER_TYPE_LIMIT,
  query = "",
  types = ["release", "age", "canon"],
}: {
  onlyActionable?: boolean;
  perTypeLimit?: number;
  query?: string;
  types?: RepairBackfillProposalType[];
} = {}): Promise<RepairBackfillProposalResult> {
  const normalizedTypes = Array.from(new Set(types));
  const proposals: RepairBackfillProposal[] = [];

  if (normalizedTypes.includes("release")) {
    const results = await collectRepairCandidates({
      fetcher: getLegacyReleaseRepairCandidates,
      perTypeLimit,
      query,
    });
    proposals.push(...results.map(toReleaseRepairBackfillProposal));
  }

  if (normalizedTypes.includes("age")) {
    const results = await collectRepairCandidates({
      fetcher: getDirtyParentAgeRepairCandidates,
      perTypeLimit,
      query,
    });
    proposals.push(...results.map(toAgeRepairBackfillProposal));
  }

  if (normalizedTypes.includes("canon")) {
    const results = await collectRepairCandidates({
      fetcher: getCanonRepairCandidates,
      perTypeLimit,
      query,
    });
    proposals.push(...results.map(toCanonRepairBackfillProposal));
  }

  const filteredProposals = onlyActionable
    ? proposals.filter((proposal) => proposal.actionability === "apply")
    : proposals;

  filteredProposals.sort((left, right) => {
    const tastingDiff =
      getProposalTastingCount(right) - getProposalTastingCount(left);
    if (tastingDiff !== 0) {
      return tastingDiff;
    }

    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }

    return left.adminHref.localeCompare(right.adminHref);
  });

  return {
    proposals: filteredProposals,
    summary: createRepairBackfillProposalSummary(filteredProposals),
  };
}
