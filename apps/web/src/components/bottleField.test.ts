import { describe, expect, it } from "vitest";

import { formatBottleOptionWithId } from "./bottleField";

describe("formatBottleOptionWithId", () => {
  it("disambiguates Bottles with the same full name", () => {
    const first = formatBottleOptionWithId({
      id: 41,
      fullName: "Lagavulin 16-year-old",
    });
    const second = formatBottleOptionWithId({
      id: 42,
      fullName: "Lagavulin 16-year-old",
    });

    expect(first).toBe("Lagavulin 16-year-old · Bottle 41");
    expect(second).toBe("Lagavulin 16-year-old · Bottle 42");
    expect(first).not.toBe(second);
  });
});
