import { describe, expect, test } from "vitest";
import { buildStorePriceNormalizationUpdate } from "./prices";

describe("buildStorePriceNormalizationUpdate", () => {
  test("includes a discovered Bottle assignment", () => {
    expect(buildStorePriceNormalizationUpdate("Normalized price", 42)).toEqual({
      name: "Normalized price",
      bottleId: 42,
    });
  });

  test("omits an unresolved Bottle assignment", () => {
    expect(
      buildStorePriceNormalizationUpdate("Normalized price", null),
    ).toEqual({
      name: "Normalized price",
    });
  });
});
