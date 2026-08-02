import type { Outputs } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";
import {
  BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS,
  getBottleCheckRefetchInterval,
} from "./polling";

type BottleCheckDetails = Outputs["bottleChecks"]["details"];

function details({
  closed = false,
  status,
}: {
  closed?: boolean;
  status: BottleCheckDetails["check"]["operations"][number]["status"];
}): BottleCheckDetails {
  return {
    check: {
      closedAt: closed ? "2026-07-30T12:00:00.000Z" : null,
      operations: [{ status }],
    },
  } as unknown as BottleCheckDetails;
}

describe("Bottle Check applying polling", () => {
  it("polls only while an open check has an applying operation", () => {
    expect(getBottleCheckRefetchInterval(details({ status: "applying" }))).toBe(
      BOTTLE_CHECK_APPLYING_REFETCH_INTERVAL_MS,
    );
    expect(getBottleCheckRefetchInterval(details({ status: "applied" }))).toBe(
      false,
    );
    expect(
      getBottleCheckRefetchInterval(
        details({ closed: true, status: "applying" }),
      ),
    ).toBe(false);
    expect(getBottleCheckRefetchInterval(undefined)).toBe(false);
  });
});
