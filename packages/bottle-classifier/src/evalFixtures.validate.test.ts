import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  classifierEvalFixtureSchema,
  listFixtureFiles,
  realWorldNewBottleFixtureSchema,
} from "./evalFixtureSchemas";

const fixtureRootDir = fileURLToPath(
  new URL("./eval-fixtures/", import.meta.url),
);
const decisionFixtureDir = `${fixtureRootDir}/decision-cases`;
const newBottleFixtureDir = `${fixtureRootDir}/new-bottles`;

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

    if (fixture.expected.action === "match" && currentBottleId !== null) {
      const matchedBottleId = fixture.expected.matchedBottleId ?? null;

      return currentBottleId === matchedBottleId
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

  test("rejects production-miss decision fixtures without observed input context", () => {
    const result = classifierEvalFixtureSchema.safeParse({
      id: "missing-observed-input",
      name: "Missing observed input",
      input: {
        reference: {
          name: "Shieldaig Speyside Single Malt 21-year-old Scotch Whisky",
        },
      },
      provenance: {
        source: "production_miss",
        verifiedSourceUrls: ["https://example.com/shieldaig"],
        dbOutcome: {
          summary: "The observed DB outcome was a compound parent repair.",
        },
      },
      expected: {
        status: "classified",
        action: "create_bottle",
        summary: "Should reject before judging the outcome.",
      },
    });

    if (result.success) {
      throw new Error(
        "Expected production-miss fixture without context to fail.",
      );
    }

    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "input.reference.url",
        "input.extractedIdentity",
        "input.initialCandidates",
      ]),
    );
  });

  test("rejects production-miss local catalog fixtures without local rows", () => {
    const result = classifierEvalFixtureSchema.safeParse({
      id: "empty-local-catalog",
      name: "Empty local catalog",
      input: {
        reference: {
          name: "Shieldaig Speyside Single Malt 21-year-old Scotch Whisky",
          url: "https://example.com/shieldaig",
        },
        extractedIdentity: {
          brand: "Shieldaig",
          bottler: null,
          expression: "Speyside",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: 21,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
      },
      localCatalog: {
        entities: [{ id: 1, name: "Shieldaig", type: ["brand"] }],
        bottles: [],
        aliases: [],
      },
      provenance: {
        source: "production_miss",
        verifiedSourceUrls: ["https://example.com/shieldaig"],
        dbOutcome: {
          summary: "The observed DB outcome used a conflicting local row.",
        },
      },
      expected: {
        status: "classified",
        action: "create_bottle",
        summary: "Should reject before judging the outcome.",
      },
    });

    if (result.success) {
      throw new Error(
        "Expected production-miss fixture without local rows to fail.",
      );
    }

    expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
      "localCatalog",
    );
  });

  test("rejects duplicate initial candidate Bottle ids", () => {
    const result = classifierEvalFixtureSchema.safeParse({
      id: "duplicate-initial-candidate-ids",
      name: "Duplicate initial candidate ids",
      input: {
        reference: {
          name: "Example 10-year-old",
        },
        initialCandidates: [
          {
            bottleId: 1,
            fullName: "Example 10-year-old",
          },
          {
            bottleId: 1,
            fullName: "Example 10-year-old Oloroso Cask",
          },
        ],
      },
      expected: {
        status: "classified",
        action: "match",
        matchedBottleId: 1,
        summary: "Duplicate candidate ids are invalid.",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["input", "initialCandidates", 1, "bottleId"],
        message: "Duplicate initial candidate Bottle id 1.",
      });
    }
  });

  test("accepts canonical cask traits in exact Bottle identity", () => {
    const fixture = realWorldNewBottleFixtureSchema.parse({
      id: "canonical-cask-traits",
      referenceName: "Example First Fill Oloroso Hogshead",
      expectedBottleName: "Example First Fill Oloroso Hogshead",
      summary: "Validates canonical structured cask traits.",
      peatedBottleIds: [1],
      expected: {
        handlingStrategy: "classifier_required",
        classifierExpectation: "bottle",
        exactBottleIdentity: {
          caskType: "oloroso",
          caskSize: "hogshead",
          caskFill: "1st_fill",
        },
      },
    });

    expect(fixture.expected.exactBottleIdentity).toEqual({
      caskType: "oloroso",
      caskSize: "hogshead",
      caskFill: "1st_fill",
    });
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
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});
