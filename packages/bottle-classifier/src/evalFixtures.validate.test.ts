import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AUDIT_BOTTLE_EVAL_CASES } from "./auditBottle.eval.fixtures";
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
const laphroaigDecisionFixtureFile = `${decisionFixtureDir}/match_existing/store-listing-matches-laphroaig-cairdeas-2022-warehouse-1.json`;
const roguesBanquetMatchFixtureFile = `${decisionFixtureDir}/match_existing/image-backed-photo-matches-compass-box-rogues-banquet.json`;
const spiceTreeRequiredChangeFixtureFile = `${decisionFixtureDir}/ignore_or_reject/image-backed-photo-requires-spice-tree-extravaganza-catalog-review.json`;

function loadLaphroaigDecisionFixture() {
  return classifierEvalFixtureSchema.parse(
    JSON.parse(readFileSync(laphroaigDecisionFixtureFile, "utf8")),
  );
}

function loadDecisionFixture(filename: string) {
  return classifierEvalFixtureSchema.parse(
    JSON.parse(readFileSync(filename, "utf8")),
  );
}

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

  test("keeps audit fixture ids unique", () => {
    const fixtures = AUDIT_BOTTLE_EVAL_CASES.map((fixture) =>
      auditBottleEvalFixtureSchema.parse(fixture),
    );

    expect(fixtures.length).toBeGreaterThan(0);
    expect(new Set(fixtures.map(({ id }) => id)).size).toBe(fixtures.length);
  });

  test("keeps the production-derived Càirdeas audit bounded and explicit about its DB outcome", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      ({ id }) =>
        id === "audit-production-laphroaig-cairdeas-2022-malformed-duplicate",
    );
    expect(fixture).toBeDefined();
    expect(fixture?.provenance.source).toBe("curated_regression");
    expect(fixture?.input.audit.bottleId).toBe(39096);
    expect(
      fixture?.input.context.inspectedBottles.map(({ bottleId }) => bottleId),
    ).toEqual([45146, 44288, 802]);
    expect(fixture?.searchResponses).toMatchObject([
      {
        when: ["laphroaig"],
        results: [{ bottleId: 45146 }, { bottleId: 44288 }, { bottleId: 802 }],
      },
    ]);
    expect(
      fixture!.input.context.bottleContexts.map(({ bottleId, groupId }) => ({
        bottleId,
        groupId,
      })),
    ).toEqual([
      { bottleId: 39096, groupId: 9433 },
      { bottleId: 45146, groupId: 18105 },
      { bottleId: 44288, groupId: 18105 },
      { bottleId: 802, groupId: 9433 },
    ]);
    expect(fixture?.provenance.verifiedSourceUrls).toEqual(
      expect.arrayContaining([
        "https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky",
      ]),
    );
    expect(fixture?.expected.proposedOperations).toMatchObject([
      {
        type: "merge_bottles",
        input: {
          sourceBottleId: 39096,
          destinationBottleId: 45146,
        },
        evidenceRefs: [
          { kind: "bottle", bottleId: 39096 },
          { kind: "bottle", bottleId: 45146 },
          {
            kind: "web_result",
            url: "https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky",
          },
        ],
      },
    ]);
    expect(fixture?.requireExpectedOperationEvidence).toBe(true);
    expect(fixture?.expected.findings).toEqual([]);
    expect(fixture?.provenance.dbOutcome).toMatchObject({
      bottleId: 45146,
      createsBottle: false,
    });
  });

  test("keeps the Pōkeno audit limited to the supported vintage repair", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      ({ id }) => id === "audit-production-pokeno-single-cask-missing-vintage",
    );

    expect(fixture).toBeDefined();
    expect(fixture?.scenario).toBe("bottle_update");
    expect(fixture?.provenance.source).toBe("production_miss");
    expect(fixture?.input.audit.bottleId).toBe(45174);
    expect(fixture?.provenance.verifiedSourceUrls).toEqual(
      expect.arrayContaining([
        "https://api.peated.com/uploads/bottles/bottle-45174-pending-upload-nh8e88y2d7atvkesunuwvo5z.webp",
        "https://www.drinqy.com/shop/p/pokeno-origin-acmb2",
      ]),
    );
    expect(fixture?.expected.proposedOperations).toMatchObject([
      {
        type: "update_bottle",
        input: {
          bottleId: 45174,
          patch: {
            exact: {
              vintageYear: 2019,
            },
          },
        },
      },
    ]);
    const expectedOperations = JSON.stringify(
      fixture?.expected.proposedOperations,
    );
    expect(expectedOperations).not.toContain('"edition"');
    expect(expectedOperations).not.toContain('"shared"');
  });

  test("keeps Proof and Wood and fills only supported Bottle fields", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      ({ id }) =>
        id ===
        "audit-production-proof-and-wood-representative-retains-bottler-and-batch-abv",
    );

    expect(fixture).toBeDefined();
    expect(fixture?.scenario).toBe("bottle_update");
    expect(fixture?.provenance.source).toBe("production_miss");
    expect(fixture?.input.audit).toEqual({
      bottleId: 45249,
      origin: "post_user_creation",
    });
    expect(fixture?.expected.proposedOperations).toEqual([
      expect.objectContaining({
        type: "update_bottle",
        input: {
          bottleId: 45249,
          patch: {
            exact: {
              caskStrength: true,
              singleCask: false,
            },
          },
        },
      }),
    ]);
    expect(fixture?.provenance.dbOutcome).toMatchObject({
      bottleId: 45249,
      createsBottle: false,
    });
  });

  test("covers real Compass Box photo misses without forcing duplicate creation", () => {
    const matchFixture = loadDecisionFixture(roguesBanquetMatchFixtureFile);
    const requiredChangeFixture = loadDecisionFixture(
      spiceTreeRequiredChangeFixtureFile,
    );
    const roguesVerifiedUrls = [
      "https://www.compassboxwhisky.com/products/rogues-banquet",
      "https://www.whiskybase.com/whiskies/whisky/145016/rogues-banquet-blended-scotch-whisky-cb",
      "https://api.peated.com/v1/bottles/13364",
    ];

    expect(matchFixture.provenance?.source).toBe("curated_regression");
    expect(matchFixture.expected).toMatchObject({
      action: "match",
      matchedBottleId: 13364,
    });
    expect(matchFixture.localCatalog?.bottles).toMatchObject([
      {
        id: 13364,
        abv: null,
        releaseYear: null,
        bottlerId: null,
        distillerIds: [],
      },
    ]);

    expect(requiredChangeFixture.provenance?.source).toBe("curated_regression");
    expect(requiredChangeFixture.localCatalog?.bottles).toMatchObject([
      {
        id: 9900,
        brandId: 1361,
        bottlerId: 1422,
        category: "single_malt",
        statedAge: 3,
      },
    ]);
    expect(requiredChangeFixture.expected).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
    });

    expect(matchFixture.provenance?.verifiedSourceUrls).toEqual(
      expect.arrayContaining(roguesVerifiedUrls),
    );
    expect(requiredChangeFixture.provenance?.verifiedSourceUrls).toEqual(
      expect.arrayContaining([
        "https://api.peated.com/v1/bottles/45175",
        "https://api.peated.com/v1/bottles/9900",
        "https://www.whiskybase.com/whiskies/whisky/87242/the-spice-tree-extravaganza-cb",
      ]),
    );

    for (const fixture of [matchFixture, requiredChangeFixture]) {
      const encodedExpectations = JSON.stringify(fixture.expected);
      expect(encodedExpectations).not.toContain("caskType");
      expect(encodedExpectations).not.toContain("caskSize");
      expect(encodedExpectations).not.toContain("caskFill");
    }
  });

  test("requires explicit audit contexts to cover exactly the fixture Bottles", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      ({ id }) =>
        id === "audit-production-laphroaig-cairdeas-2022-malformed-duplicate",
    );
    expect(fixture).toBeDefined();

    const result = auditBottleEvalFixtureSchema.safeParse({
      ...fixture,
      input: {
        ...fixture!.input,
        context: {
          ...fixture!.input.context,
          bottleContexts: fixture!.input.context.bottleContexts?.slice(0, 2),
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message:
            "Explicit Bottle contexts must exactly cover the current and inspected Bottle ids.",
          path: ["input", "context", "bottleContexts"],
        }),
      );
    }
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

  test("uses exact bounded contexts for the production Laphroaig decision case", () => {
    const fixture = loadLaphroaigDecisionFixture();
    const contexts = fixture.context.bottleContexts ?? [];

    expect(
      contexts.map((context) => ({
        bottleId: context?.bottleId,
        groupId: context?.groupId,
      })),
    ).toEqual([
      { bottleId: 39096, groupId: 9433 },
      { bottleId: 45146, groupId: 18105 },
      { bottleId: 44288, groupId: 18105 },
    ]);
    expect(fixture.provenance?.catalogFieldObservations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: 39096,
          field: "edition",
          evidenceValue: "Warehouse 1",
          source: "image_evidence",
        }),
        expect.objectContaining({
          bottleId: 39096,
          field: "abv",
          evidenceValue: 52.2,
          source: "image_evidence",
        }),
      ]),
    );
    expect(fixture.expected).toMatchObject({
      status: "classified",
      action: "match",
      matchedBottleId: 45146,
    });
    expect(fixture.provenance?.dbOutcome).toMatchObject({
      bottleId: 45146,
      createsBottle: false,
    });
  });

  test("keeps explicit decision contexts complete and free of private API fields", () => {
    const fixture = loadLaphroaigDecisionFixture();
    const serializedContexts = JSON.stringify(fixture.context.bottleContexts);

    for (const field of [
      "createdAt",
      "createdBy",
      "createdByActorId",
      "username",
      "private",
      "friendStatus",
      "rating",
      "isFavorite",
      "isLibrary",
      "hasTasted",
    ]) {
      expect(serializedContexts).not.toContain(`"${field}"`);
    }

    const result = classifierEvalFixtureSchema.safeParse({
      ...fixture,
      context: {
        ...fixture.context,
        bottleContexts: fixture.context.bottleContexts?.slice(0, 2),
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message:
            "Explicit Bottle contexts must exactly cover inspected Bottle ids.",
          path: ["context", "bottleContexts"],
        }),
      );
    }
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

  test("requires expected operation targets to be inspectable", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      ({ id }) =>
        id === "audit-production-laphroaig-cairdeas-2022-malformed-duplicate",
    );
    expect(fixture).toBeDefined();

    const uninspected = auditBottleEvalFixtureSchema.safeParse({
      ...fixture,
      input: {
        ...fixture!.input,
        context: {
          ...fixture!.input.context,
          inspectedBottles: fixture!.input.context.inspectedBottles.filter(
            ({ bottleId }) => bottleId !== 45146,
          ),
          bottleContexts: fixture!.input.context.bottleContexts.filter(
            ({ bottleId }) => bottleId !== 45146,
          ),
        },
      },
    });
    expect(uninspected.success).toBe(false);
    if (!uninspected.success) {
      expect(uninspected.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Expected operation references uninspected Bottle id 45146.",
        }),
      );
    }
  });

  test("keeps compatibility cask metadata out of exact identity expectations", () => {
    const fixture = {
      id: "canonical-cask-traits",
      referenceName: "Example First Fill Oloroso Hogshead",
      expectedBottleName: "Example First Fill Oloroso Hogshead",
      summary: "Validates the exact identity expectation boundary.",
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
    };

    expect(realWorldNewBottleFixtureSchema.safeParse(fixture).success).toBe(
      false,
    );
    expect(
      realWorldNewBottleFixtureSchema.parse({
        ...fixture,
        expected: {
          ...fixture.expected,
          exactBottleIdentity: {
            edition: "Annual Release",
            releaseYear: 2024,
            vintageYear: 2012,
          },
        },
      }).expected.exactBottleIdentity,
    ).toEqual({
      edition: "Annual Release",
      releaseYear: 2024,
      vintageYear: 2012,
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
