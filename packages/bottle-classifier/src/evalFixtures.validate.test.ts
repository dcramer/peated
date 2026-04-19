import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  classifierEvalFixtureSchema,
  legacyReleaseRepairResolutionEvalFixtureSchema,
  listFixtureFiles,
  realWorldNewBottleFixtureSchema,
} from "./evalFixtureSchemas";

const fixtureRootDir = fileURLToPath(
  new URL("./eval-fixtures/", import.meta.url),
);
const decisionFixtureDir = `${fixtureRootDir}/decision-cases`;
const newBottleFixtureDir = `${fixtureRootDir}/new-bottles`;
const legacyRepairFixtureDir = `${fixtureRootDir}/legacy-release-repair`;

function inferDecisionScenario(
  fixture: ReturnType<typeof classifierEvalFixtureSchema.parse>,
) {
  if (
    fixture.expected.status === "ignored" ||
    fixture.expected.action === "no_match"
  ) {
    return "ignore_or_reject";
  }

  if (fixture.expected.status === "classified") {
    const currentBottleId = fixture.input.reference.currentBottleId ?? null;
    const currentReleaseId = fixture.input.reference.currentReleaseId ?? null;

    if (
      fixture.expected.action === "match" &&
      (currentBottleId !== null || currentReleaseId !== null)
    ) {
      const matchedBottleId = fixture.expected.matchedBottleId ?? null;
      const matchedReleaseId = fixture.expected.matchedReleaseId ?? null;

      return currentBottleId === matchedBottleId &&
        currentReleaseId === matchedReleaseId
        ? "match_existing"
        : "corrections";
    }

    if (fixture.expected.action === "match") {
      return "match_existing";
    }
  }

  return "new_bottles";
}

describe("eval fixture validation", () => {
  test("keeps decision fixtures aligned with their scenario directories", () => {
    const ids: string[] = [];

    for (const filename of listFixtureFiles(decisionFixtureDir)) {
      const fixture = classifierEvalFixtureSchema.parse(
        JSON.parse(readFileSync(filename, "utf8")),
      );

      ids.push(fixture.id);
      expect(path.basename(path.dirname(filename))).toBe(
        inferDecisionScenario(fixture),
      );
    }

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps real-world new-bottle fixtures schema-valid and provenance-backed", () => {
    const ids: string[] = [];

    for (const filename of listFixtureFiles(newBottleFixtureDir)) {
      const fixture = realWorldNewBottleFixtureSchema.parse(
        JSON.parse(readFileSync(filename, "utf8")),
      );

      ids.push(fixture.id);
      expect(fixture.peatedBottleIds.length).toBeGreaterThan(0);
      expect(new Set(fixture.peatedBottleIds).size).toBe(
        fixture.peatedBottleIds.length,
      );
    }

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps legacy release repair fixtures schema-valid", () => {
    const ids: string[] = [];

    for (const filename of listFixtureFiles(legacyRepairFixtureDir)) {
      const fixture = legacyReleaseRepairResolutionEvalFixtureSchema.parse(
        JSON.parse(readFileSync(filename, "utf8")),
      );

      ids.push(fixture.id);
      expect(fixture.referenceName.length).toBeGreaterThan(0);
      expect(fixture.name.length).toBeGreaterThan(0);
    }

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps file-backed eval fixture ids globally unique", () => {
    const ids = [
      ...listFixtureFiles(decisionFixtureDir).map(
        (filename) =>
          classifierEvalFixtureSchema.parse(
            JSON.parse(readFileSync(filename, "utf8")),
          ).id,
      ),
      ...listFixtureFiles(newBottleFixtureDir).map(
        (filename) =>
          realWorldNewBottleFixtureSchema.parse(
            JSON.parse(readFileSync(filename, "utf8")),
          ).id,
      ),
      ...listFixtureFiles(legacyRepairFixtureDir).map(
        (filename) =>
          legacyReleaseRepairResolutionEvalFixtureSchema.parse(
            JSON.parse(readFileSync(filename, "utf8")),
          ).id,
      ),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});
