import { describe, expect, test } from "vitest";

import { buildAgeStats } from "./age-stats";

describe("buildAgeStats", () => {
  test("handles more ages than can be passed as function arguments", () => {
    const ages = Array.from({ length: 200_000 }, (_, index) => index);

    const stats = buildAgeStats(ages, 0);

    expect(stats.knownCount).toBe(200_000);
    expect(stats.median).toBe(99_999.5);
    expect(stats.oldest).toBe(199_999);
  });
});
