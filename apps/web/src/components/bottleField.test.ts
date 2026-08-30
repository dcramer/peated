import { describe, expect, it } from "vitest";

import { formatBottleOptionWithId } from "./bottleField";

describe("formatBottleOptionWithId", () => {
  it("disambiguates bottles with the same clean identity", () => {
    const first = formatBottleOptionWithId({
      abv: 43,
      brand: { name: "Lagavulin" },
      id: 41,
      name: "16-year-old - 43.0% ABV",
      statedAge: 16,
    });
    const second = formatBottleOptionWithId({
      abv: 43,
      brand: { name: "Lagavulin" },
      id: 42,
      name: "16-year-old - 43.0% ABV",
      statedAge: 16,
    });

    expect(first).toBe("Lagavulin 16-year-old · Bottle 41");
    expect(second).toBe("Lagavulin 16-year-old · Bottle 42");
    expect(first).not.toBe(second);
  });
});
