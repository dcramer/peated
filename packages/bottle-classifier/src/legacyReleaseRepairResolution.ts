import type { BottleClassificationResult } from "./contract";
import {
  hasDirtyLegacyReleaseRepairParent,
  type LegacyReleaseRepairParentCandidate,
} from "./legacyReleaseRepairIdentity";
import type { ReleaseIdentityInput } from "./releaseIdentity";

export type LegacyReleaseRepairClassifierBlockedReason =
  | "classifier_ignored"
  | "classifier_exact_cask"
  | "classifier_outside_parent_set"
  | "classifier_dirty_parent_candidate"
  | "classifier_unresolved_parent_decision";

export type LegacyReleaseRepairClassifierResolution<
  TRow extends LegacyReleaseRepairParentCandidate =
    LegacyReleaseRepairParentCandidate,
> =
  | {
      parentBottle: TRow;
      resolution: "reuse_existing_parent";
    }
  | {
      resolution: "allow_create_parent";
    }
  | {
      ignoredReason?: string;
      reason: LegacyReleaseRepairClassifierBlockedReason;
      resolution: "blocked";
    };

export function resolveLegacyCreateParentClassification<
  TRow extends LegacyReleaseRepairParentCandidate,
>({
  classification,
  parentRows,
  release,
}: {
  classification: BottleClassificationResult;
  parentRows: TRow[];
  release?: Partial<ReleaseIdentityInput>;
}): LegacyReleaseRepairClassifierResolution<TRow> {
  if (classification.status === "ignored") {
    return {
      resolution: "blocked",
      reason: "classifier_ignored",
      ignoredReason: classification.reason,
    };
  }

  const { decision } = classification;
  if (decision.identityScope === "exact_cask") {
    return {
      resolution: "blocked",
      reason: "classifier_exact_cask",
    };
  }

  if (
    decision.action === "match" ||
    decision.action === "repair_bottle" ||
    decision.action === "create_release"
  ) {
    let parentBottleId: number;
    if (decision.action === "create_release") {
      parentBottleId = decision.parentBottleId;
    } else {
      parentBottleId = decision.matchedBottleId;
    }
    const parentBottle =
      parentRows.find((row) => row.id === parentBottleId) ?? null;

    if (!parentBottle) {
      return {
        resolution: "blocked",
        reason: "classifier_outside_parent_set",
      };
    }

    if (hasDirtyLegacyReleaseRepairParent(parentBottle, release)) {
      return {
        resolution: "blocked",
        reason: "classifier_dirty_parent_candidate",
      };
    }

    return {
      resolution: "reuse_existing_parent",
      parentBottle,
    };
  }

  if (
    decision.action === "create_bottle" ||
    decision.action === "create_bottle_and_release"
  ) {
    return {
      resolution: "allow_create_parent",
    };
  }

  return {
    resolution: "blocked",
    reason: "classifier_unresolved_parent_decision",
  };
}

export function getLegacyReleaseRepairClassifierBlockedReasonMessage({
  ignoredReason,
  reason,
}: {
  ignoredReason?: string;
  reason: LegacyReleaseRepairClassifierBlockedReason;
}): string {
  switch (reason) {
    case "classifier_ignored":
      return `Classifier could not review parent resolution: ${ignoredReason ?? "ignored"}`;
    case "classifier_exact_cask":
      return "Classifier treated this bottle as exact-cask identity, so release repair cannot safely create a reusable parent bottle.";
    case "classifier_outside_parent_set":
      return "Classifier pointed at a bottle outside the reviewed repair parent set.";
    case "classifier_dirty_parent_candidate":
      return "Classifier found a reusable parent candidate, but that bottle still has bottle-level release traits.";
    case "classifier_unresolved_parent_decision":
      return "Classifier could not verify whether this repair should reuse an existing parent bottle or create a new one.";
  }
}
