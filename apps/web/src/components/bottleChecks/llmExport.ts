import type { Outputs } from "@peated/server/orpc/router";

type BottleCheckDetails = Outputs["audits"]["details"];

export function formatBottleCheckOperationLlmExport({
  check,
  liveReview,
  operation,
}: {
  check: BottleCheckDetails["audit"];
  liveReview: BottleCheckDetails["reviewOperations"][number] | null;
  operation: BottleCheckDetails["audit"]["operations"][number];
}) {
  const { operations: _operations, ...checkContext } = check;

  return JSON.stringify(
    {
      schemaVersion: 1,
      source: "peated.admin.audit_operation",
      audit: checkContext,
      operation,
      liveReview,
    },
    null,
    2,
  );
}
