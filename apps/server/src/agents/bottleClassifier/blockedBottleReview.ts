import type { BottleClassificationResult } from "@peated/bottle-classifier/contract";
import { pushJob } from "@peated/server/worker/client";

/**
 * Every source shares this step (owner: Bottle classifier). A `no_match` that
 * names a Blocked Bottle starts one Bottle Review for it, so the stored
 * conflict gets a Suggested Change instead of blocking every later source.
 */
export async function queueBlockedBottleReview(
  result: BottleClassificationResult,
) {
  if (result.status !== "classified") return;
  const decision = result.decision;
  if (decision.action !== "no_match" || !decision.blockedBottle) return;

  const { bottleId, fields, note } = decision.blockedBottle;
  await pushJob("ReviewBlockedBottle", { bottleId, fields, note });
}
