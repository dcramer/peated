import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  AUDIT_BOTTLE_EVAL_CASES,
  buildAuditEvalBottleContext,
} from "./auditBottle.eval.fixtures";
import {
  auditBottleEvalFixtureSchema,
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

  test("keeps a small, synthetic audit corpus covering each supported scenario", () => {
    expect(AUDIT_BOTTLE_EVAL_CASES).toHaveLength(6);
    expect(
      AUDIT_BOTTLE_EVAL_CASES.map((fixture) => fixture.scenario).sort(),
    ).toEqual([
      "adversarial",
      "bottle_merge",
      "bottle_update",
      "clean",
      "entity_operations",
      "unresolved",
    ]);
    expect(
      new Set(AUDIT_BOTTLE_EVAL_CASES.map((fixture) => fixture.id)).size,
    ).toBe(AUDIT_BOTTLE_EVAL_CASES.length);
    expect(
      AUDIT_BOTTLE_EVAL_CASES.every(
        (fixture) => fixture.provenance.source === "synthetic",
      ),
    ).toBe(true);
  });

  test("covers the supported Bottle and Entity operations without adding audit-only variants", () => {
    const operations = AUDIT_BOTTLE_EVAL_CASES.flatMap(
      (fixture) => fixture.expected.proposedOperations,
    );
    expect(new Set(operations.map((operation) => operation.type))).toEqual(
      new Set([
        "update_bottle",
        "merge_bottles",
        "update_entity",
        "merge_entities",
      ]),
    );

    const bottleUpdate = operations.find(
      (operation) => operation.type === "update_bottle",
    );
    expect(bottleUpdate?.input.patch.shared?.brand).toMatchObject({
      kind: "existing",
      entityId: 5202,
    });
    expect(bottleUpdate?.input.patch.shared?.bottler).toMatchObject({
      kind: "create",
      entity: {
        name: "Harbor House Bottling",
        roles: ["bottler"],
      },
    });
    expect(bottleUpdate?.input.patch.shared?.seriesId).toBe(5290);
    const bottleUpdateFixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (fixture) => fixture.scenario === "bottle_update",
    );
    expect(bottleUpdateFixture?.input.context.inspectedSeries).toContainEqual({
      seriesId: 5290,
      name: "Harbor House Special Releases",
    });
    expect(
      bottleUpdateFixture?.input.context.inspectedBottles.some(
        (bottle) =>
          bottle.series === "Harbor House Special Releases" &&
          bottle.bottleId === 50202,
      ),
    ).toBe(true);
    const seriesBottle =
      bottleUpdateFixture?.input.context.inspectedBottles.find(
        ({ bottleId }) => bottleId === 50202,
      );
    expect(seriesBottle).toBeDefined();
    expect(
      buildAuditEvalBottleContext(
        seriesBottle!,
        bottleUpdateFixture!.input.context.inspectedEntities,
        bottleUpdateFixture!.input.context.inspectedSeries,
      ).shared.series,
    ).toEqual({
      seriesId: 5290,
      name: "Harbor House Special Releases",
    });

    const unresolved = AUDIT_BOTTLE_EVAL_CASES.find(
      (fixture) => fixture.scenario === "unresolved",
    );
    expect(unresolved?.expected.proposedOperations).toEqual([]);
    expect(unresolved?.expected.findings).toHaveLength(1);
  });

  test("rejects audit expectations that mutate an uninspected target", () => {
    const cleanFixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (fixture) => fixture.scenario === "clean",
    );
    expect(cleanFixture).toBeDefined();

    const result = auditBottleEvalFixtureSchema.safeParse({
      ...cleanFixture,
      expected: {
        ...cleanFixture?.expected,
        proposedOperations: [
          {
            type: "update_entity",
            input: {
              entityId: 9999,
              patch: { name: "Uninspected Entity" },
            },
            rationale: "This target was never inspected.",
            evidenceRefs: [{ kind: "entity", entityId: 9999 }],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        message: "Expected operation references uninspected Entity id 9999.",
      });
    }
  });

  test("validates nested existing Entity and Series targets but exempts Entity drafts", () => {
    const cleanFixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (fixture) => fixture.scenario === "clean",
    );
    expect(cleanFixture).toBeDefined();

    const result = auditBottleEvalFixtureSchema.safeParse({
      ...cleanFixture,
      expected: {
        ...cleanFixture?.expected,
        proposedOperations: [
          {
            type: "update_bottle",
            input: {
              bottleId: cleanFixture!.input.audit.bottleId,
              patch: {
                shared: {
                  seriesId: 9901,
                  brand: { kind: "existing", entityId: 9902 },
                  distillers: [
                    { kind: "existing", entityId: 9903 },
                    {
                      kind: "create",
                      entity: {
                        name: "New Distiller",
                        roles: ["distiller"],
                      },
                    },
                  ],
                  bottler: { kind: "existing", entityId: 9904 },
                },
              },
            },
            rationale: "These existing targets were never inspected.",
            evidenceRefs: [
              {
                kind: "bottle",
                bottleId: cleanFixture!.input.audit.bottleId,
              },
            ],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.map(({ message, path }) => ({
          message,
          path: path.join("."),
        })),
      ).toEqual([
        {
          message:
            "Expected operation references uninspected BottleSeries id 9901.",
          path: "expected.proposedOperations.0.input.patch.shared.seriesId",
        },
        {
          message: "Expected operation references uninspected Entity id 9902.",
          path: "expected.proposedOperations.0.input.patch.shared.brand.entityId",
        },
        {
          message: "Expected operation references uninspected Entity id 9903.",
          path: "expected.proposedOperations.0.input.patch.shared.distillers.0.entityId",
        },
        {
          message: "Expected operation references uninspected Entity id 9904.",
          path: "expected.proposedOperations.0.input.patch.shared.bottler.entityId",
        },
      ]);
    }
  });

  test("rejects duplicate normalized inspected Series names", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (candidate) => candidate.scenario === "bottle_update",
    );
    expect(fixture).toBeDefined();

    const result = auditBottleEvalFixtureSchema.safeParse({
      ...fixture,
      input: {
        ...fixture!.input,
        context: {
          ...fixture!.input.context,
          inspectedSeries: [
            ...fixture!.input.context.inspectedSeries,
            {
              seriesId: 5291,
              name: "  harbor   HOUSE special releases  ",
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message:
            "Duplicate inspected BottleSeries name harbor   HOUSE special releases.",
          path: ["input", "context", "inspectedSeries", 1, "name"],
        }),
      );
    }
  });

  test("rejects inspected Series that no fixture Bottle can expose", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (candidate) => candidate.scenario === "bottle_update",
    );
    expect(fixture).toBeDefined();

    const result = auditBottleEvalFixtureSchema.safeParse({
      ...fixture,
      input: {
        ...fixture!.input,
        context: {
          ...fixture!.input.context,
          inspectedSeries: [
            ...fixture!.input.context.inspectedSeries,
            {
              seriesId: 5291,
              name: "Unreachable Series",
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message:
            "Inspected BottleSeries Unreachable Series is not referenced by any fixture Bottle.",
          path: ["input", "context", "inspectedSeries", 1, "name"],
        }),
      );
    }
  });

  test("uses the same normalized Series name for reachability and BottleContext synthesis", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (candidate) => candidate.scenario === "bottle_update",
    );
    expect(fixture).toBeDefined();

    const result = auditBottleEvalFixtureSchema.safeParse({
      ...fixture,
      input: {
        ...fixture!.input,
        context: {
          ...fixture!.input.context,
          inspectedBottles: fixture!.input.context.inspectedBottles.map(
            (bottle) =>
              bottle.bottleId === 50202
                ? {
                    ...bottle,
                    series: "  HARBOR   house special releases  ",
                  }
                : bottle,
          ),
        },
      },
    });

    if (!result.success) {
      throw result.error;
    }
    const seriesBottle = result.data.input.context.inspectedBottles.find(
      ({ bottleId }) => bottleId === 50202,
    );
    expect(seriesBottle).toBeDefined();
    expect(
      buildAuditEvalBottleContext(
        seriesBottle!,
        result.data.input.context.inspectedEntities,
        result.data.input.context.inspectedSeries,
      ).shared.series,
    ).toEqual({
      seriesId: 5290,
      name: "Harbor House Special Releases",
    });
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

  test("preserves an observed null extraction in a production-miss fixture", () => {
    const fixture = classifierEvalFixtureSchema.parse({
      id: "null-observed-extraction",
      name: "Null observed extraction",
      input: {
        reference: {
          name: "Laphroaig Càirdeas 2022",
          url: "https://example.com/laphroaig-cairdeas-2022",
        },
        extractedIdentity: null,
        initialCandidates: [
          {
            bottleId: 45146,
            fullName: "Laphroaig Càirdeas Warehouse 1 2022 Release",
          },
        ],
      },
      provenance: {
        source: "production_miss",
        verifiedSourceUrls: [
          "https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky",
        ],
        dbOutcome: {
          bottleId: 45146,
          createsBottle: false,
          summary: "Match the observed listing to Bottle 45146.",
        },
      },
      expected: {
        status: "classified",
        action: "match",
        matchedBottleId: 45146,
        summary: "Match the existing Warehouse 1 Bottle.",
      },
    });

    expect(fixture.input.extractedIdentity).toBeNull();
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
