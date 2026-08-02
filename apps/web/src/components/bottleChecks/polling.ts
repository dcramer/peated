import type { Outputs } from "@peated/server/orpc/router";

type BottleCheckDetails = Outputs["bottleChecks"]["details"];

export const BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS = 5_000;

export function getBottleCheckRefetchInterval(
  details: BottleCheckDetails | undefined,
): number | false {
  if (!details || details.check.closedAt) return false;
  return details.check.operations.some(
    (operation) => operation.status === "applying",
  )
    ? BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS
    : false;
}
