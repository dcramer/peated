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
  getRepairBackfillProposals,
  type AgeRepairBackfillProposal,
  type ReleaseRepairBackfillProposal,
  type RepairBackfillProposal,
  type RepairBackfillProposalType,
} from "@peated/server/lib/repairBackfillProposals";

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

type BatchApplicableRepairProposal =
  | AgeRepairBackfillProposal
  | ReleaseRepairBackfillProposal;

function isBatchApplicableRepairProposal(
  proposal: RepairBackfillProposal,
): proposal is BatchApplicableRepairProposal {
  return (
    proposal.actionability === "apply" &&
    (proposal.type === "release" || proposal.type === "age")
  );
}

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
  user: User;
}): Promise<ApplyRepairBackfillProposalsResult> {
  const proposalTypes = Array.from(
    new Set(types),
  ) as RepairBackfillProposalType[];
  const { proposals } = await getRepairBackfillProposals({
    onlyActionable: true,
    perTypeLimit,
    query,
    types: proposalTypes,
  });

  const applicableProposals = proposals.filter(isBatchApplicableRepairProposal);
  const items: ApplyRepairBackfillProposalItem[] = [];

  for (const proposal of applicableProposals) {
    if (dryRun) {
      items.push(createDryRunItem(proposal));
      continue;
    }

    items.push(await applyRepairBackfillProposal(proposal, user));
  }

  return {
    items,
    summary: createResultSummary(items),
  };
}
