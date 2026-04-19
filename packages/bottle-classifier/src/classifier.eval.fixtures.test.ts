import { describe, expect, test } from "vitest";
import { EVAL_CASES } from "./classifier.eval.fixtures";

describe("classifier eval fixtures", () => {
  test("loads at least one decision fixture", () => {
    expect(EVAL_CASES.length).toBeGreaterThan(0);
  });

  test("keeps fixture ids unique", () => {
    const ids = EVAL_CASES.map((fixture) => fixture.fixtureId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps every decision fixture tied to a concrete listing name", () => {
    for (const fixture of EVAL_CASES) {
      expect(fixture.name.length).toBeGreaterThan(0);
      expect(fixture.input.reference.name.length).toBeGreaterThan(0);
      expect(fixture.expected.summary.length).toBeGreaterThan(0);
    }
  });
});
