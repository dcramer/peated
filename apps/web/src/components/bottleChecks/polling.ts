import type { Outputs } from "@peated/server/orpc/router";

type BottleCheckDetails = Outputs["audits"]["details"];

export const BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS = 5_000;

export function getBottleCheckRefetchInterval(
  details: BottleCheckDetails | undefined,
): number | false {
  if (!details || details.audit.closedAt) return false;
  return details.audit.operations.some(
    (operation) => operation.status === "applying",
  )
    ? BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS
    : false;
}
