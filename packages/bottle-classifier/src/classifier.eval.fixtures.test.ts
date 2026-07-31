import { describe, expect, test } from "vitest";
import { EVAL_CASES } from "./classifier.eval.fixtures";
import { buildBottleClassificationArtifacts } from "./contract";
import {
  getDeterministicIdentitySeed,
  resolveDeterministicBottleReference,
} from "./runtime/deterministic";

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

  test("keeps the deterministic operation fixture anchored to its selected match", () => {
    const fixture = EVAL_CASES.find(
      ({ fixtureId }) =>
        fixtureId ===
        "deterministic-primary-match-still-proposes-supplemental-merge",
    );
    expect(fixture).toBeDefined();

    const extractedIdentity = getDeterministicIdentitySeed(
      fixture!.input.reference,
    );
    const decision = resolveDeterministicBottleReference({
      reference: fixture!.input.reference,
      artifacts: buildBottleClassificationArtifacts({
        extractedIdentity,
        candidates: fixture!.input.initialCandidates,
      }),
    });

    expect(decision).toMatchObject({
      action: "match",
      identityScope: "exact_cask",
      matchedBottleId: 6505,
    });
  });
});
