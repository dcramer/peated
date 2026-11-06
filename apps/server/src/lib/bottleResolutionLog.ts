/**
 * Bottle resolution telemetry (owner: Bottle resolution). Each incoming source
 * logs one line when its classifier result is decided, so the share resolved
 * automatically, sent to review, or ignored, and why, can be counted in Sentry
 * Logs by source. An automatic write that fails afterward is reported where it
 * fails, as an errored proposal or a failed job. It is diagnostic telemetry only: it never creates a Sentry
 * issue or changes the result, and it records IDs and fixed values, not source
 * text.
 */
import type { BottleClassificationDecision } from "@peated/bottle-classifier/internal/types";
import { logInfo } from "@peated/server/lib/log";

export type BottleResolutionOutcome = "automatic" | "review" | "ignored";

export function logBottleResolution({
  sourceKind,
  sourceId,
  checkId = null,
  outcome,
  action,
  automationBlockers = [],
}: {
  sourceKind: "store_price" | "auction_lot" | "review";
  sourceId: number;
  checkId?: number | null;
  outcome: BottleResolutionOutcome;
  // The classifier's action; `ignore` when it ignored the source, null when
  // the saved check could not be read.
  action: BottleClassificationDecision["action"] | "ignore" | null;
  // Why the shared Bottle resolution check held a decision for review.
  automationBlockers?: string[];
}) {
  logInfo("Bottle resolution recorded", {
    extra: {
      sourceKind,
      sourceId,
      checkId,
      outcome,
      action,
      // Sentry Logs keep only text and numbers, so the reasons are one value.
      automationBlockers: automationBlockers.join("; ") || "none",
    },
  });
}
