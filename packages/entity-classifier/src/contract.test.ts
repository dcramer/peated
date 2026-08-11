import { describe, expect, test } from "vitest";
import {
  ClassifyEntityInputSchema,
  EntityClassificationResultSchema,
} from "./contract";

describe("entity classifier contract", () => {
  test("parses a suspect entity reference", () => {
    expect(
      ClassifyEntityInputSchema.parse({
        reference: {
          entity: {
            id: 1,
            name: "Canadian",
            shortName: null,
            aliases: ["Canadian"],
            type: ["brand", "distiller"],
            website: "https://www.canadianwhisky.org/",
            countryName: "Canada",
            regionName: null,
            totalBottles: 31,
            totalTastings: 0,
          },
          reasons: [
            {
              kind: "brand_repair_group",
              summary: "Multiple bottles support Canadian Club instead.",
              details: null,
            },
          ],
          sampleBottles: [
            {
              id: 1,
              fullName: "Canadian Club Premium",
              name: "Premium",
              category: "blend",
              totalTastings: 5,
            },
          ],
          candidateTargets: [
            {
              entityId: 2,
              name: "Canadian Club",
              shortName: null,
              aliases: ["Canadian Club"],
              type: ["brand"],
              website: "https://www.canadianclub.com/",
              score: null,
              candidateCount: 2,
              totalTastings: 14,
              supportingBottleIds: [1, 2],
              reason: "Grouped bottle repair evidence points at Canadian Club.",
              source: ["grouped_brand_repair"],
            },
          ],
        },
      }),
    ).toBeTruthy();
  });

  test("parses a structured classification result", () => {
    expect(
      EntityClassificationResultSchema.parse({
        advice: {
          kind: "brand_assignment_issue",
          summary:
            "Bottle evidence and official branding identify Canadian Club as the probable Brand.",
          targetEntityId: 2,
          evidenceUrls: ["https://www.canadianclub.com/"],
        },
        artifacts: {
          resolvedEntities: [],
          searchEvidence: [],
        },
      }),
    ).toBeTruthy();
  });

  test("rejects legacy change payloads", () => {
    const result = EntityClassificationResultSchema.safeParse({
      advice: {
        kind: "brand_assignment_issue",
        summary: "The reviewed evidence supports another Brand.",
        targetEntityId: null,
        confidence: 95,
        reassignBottleIds: [],
        preserveSourceAsDistillery: false,
        metadataPatch: {},
        evidenceUrls: [],
      },
      artifacts: {
        resolvedEntities: [],
        searchEvidence: [],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "unrecognized_keys",
          keys: [
            "confidence",
            "reassignBottleIds",
            "preserveSourceAsDistillery",
            "metadataPatch",
          ],
          path: ["advice"],
        }),
      );
    }
  });
});
