import {
  buildBottleClassificationArtifacts,
  type BottleClassificationResult,
} from "@peated/bottle-classifier/contract";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { describe, expect, test } from "vitest";
import { queueBlockedBottleReview } from "./blockedBottleReview";

const blockedBottle = {
  bottleId: 44931,
  fields: ["bottler" as const],
  note: "Stored bottler is Glengyle. The product page shows an official release.",
};

function classified(
  decision: Extract<
    BottleClassificationResult,
    { status: "classified" }
  >["decision"],
): BottleClassificationResult {
  return {
    status: "classified",
    decision,
    artifacts: buildBottleClassificationArtifacts({}),
  };
}

describe("queueBlockedBottleReview", () => {
  test("queues one Bottle Review for a no_match that names a Blocked Bottle", async () => {
    await queueBlockedBottleReview(
      classified({
        action: "no_match",
        rationale: "Batch 3 has a wrong stored bottler.",
        candidateBottleIds: [44931],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        proposedBottle: null,
        blockedBottle,
      }),
    );

    expect(pushJob).toHaveBeenCalledExactlyOnceWith(
      "ReviewBlockedBottle",
      blockedBottle,
    );
  });

  test("queues nothing for a no_match without a Blocked Bottle", async () => {
    await queueBlockedBottleReview(
      classified({
        action: "no_match",
        rationale: "The batch is unclear.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        proposedBottle: null,
      }),
    );

    expect(pushJob).not.toHaveBeenCalled();
  });
});
