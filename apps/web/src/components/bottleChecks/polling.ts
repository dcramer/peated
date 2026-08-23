import type { Outputs } from "@peated/server/orpc/router";

type BottleCheckDetails = Outputs["audits"]["details"];

export interface ApplyingBottleCheckDetails {
  audit: {
    closedAt: BottleCheckDetails["audit"]["closedAt"];
    operations: Array<
      Pick<BottleCheckDetails["audit"]["operations"][number], "status">
    >;
  };
}

export const BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS = 5_000;

export function getBottleCheckRefetchInterval(
  details: ApplyingBottleCheckDetails | undefined,
): number | false {
  if (!details || details.audit.closedAt) return false;
  return details.audit.operations.some(
    (operation) => operation.status === "applying",
  )
    ? BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS
    : false;
}
