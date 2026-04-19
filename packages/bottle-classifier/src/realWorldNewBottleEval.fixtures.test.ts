import { describe, expect, test } from "vitest";
import { REAL_WORLD_NEW_BOTTLE_EVAL_CASES } from "./realWorldNewBottleEval.fixtures";

describe("real-world new-bottle eval fixtures", () => {
  test("loads at least one fixture", () => {
    expect(REAL_WORLD_NEW_BOTTLE_EVAL_CASES.length).toBeGreaterThan(0);
  });

  test("keeps fixture ids unique", () => {
    const ids = REAL_WORLD_NEW_BOTTLE_EVAL_CASES.map(
      (fixture) => fixture.fixtureId,
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("requires every fixture to carry real Peated bottle provenance", () => {
    for (const fixture of REAL_WORLD_NEW_BOTTLE_EVAL_CASES) {
      expect(fixture.peatedBottleIds.length).toBeGreaterThan(0);

      for (const bottleId of fixture.peatedBottleIds) {
        expect(Number.isInteger(bottleId)).toBe(true);
        expect(bottleId).toBeGreaterThan(0);
      }
    }
  });
});
