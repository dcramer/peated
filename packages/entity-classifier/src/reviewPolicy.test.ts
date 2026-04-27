import { describe, expect, test } from "vitest";
import type { EntityClassificationReference } from "./classifierTypes";
import { buildEntityClassificationArtifacts } from "./contract";
import { finalizeEntityClassification } from "./reviewPolicy";

const reference: EntityClassificationReference = {
  entity: {
    id: 1,
    name: "Canadian",
    shortName: null,
    aliases: [],
    type: ["brand"],
    website: null,
    countryName: null,
    regionName: null,
    totalBottles: 2,
    totalTastings: 0,
  },
  reasons: [],
  sampleBottles: [
    {
      id: 10,
      fullName: "Canadian Club Premium",
      name: "Premium",
      category: "blend",
      totalTastings: 1,
    },
  ],
  candidateTargets: [
    {
      entityId: 2,
      name: "Canadian Club",
      shortName: null,
      aliases: [],
      type: ["brand"],
      website: "https://www.canadianclub.com/",
      score: null,
      candidateCount: 1,
      totalTastings: 1,
      supportingBottleIds: [10],
      reason: "Grouped evidence points at Canadian Club.",
      source: ["grouped_brand_repair"],
    },
  ],
};

describe("finalizeEntityClassification", () => {
  test("filters reassignment bottle ids to grouped local evidence", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      decision: {
        verdict: "reassign_bottles_to_existing_brand",
        confidence: 95,
        rationale: "Canadian Club owns the verified bottle.",
        targetEntityId: 2,
        targetEntityName: "Wrong model text",
        reassignBottleIds: [10, 99],
        preserveSourceAsDistillery: true,
        metadataPatch: {},
        blockers: [],
        evidenceUrls: [],
      },
    });

    expect(result).toMatchObject({
      verdict: "reassign_bottles_to_existing_brand",
      targetEntityName: "Canadian Club",
      reassignBottleIds: [10],
    });
    expect(result.blockers).toContain(
      "Server removed reassignment bottle ids that were not in grouped local evidence.",
    );
  });

  test("downgrades reassignment to unknown target ids", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      decision: {
        verdict: "reassign_bottles_to_existing_brand",
        confidence: 95,
        rationale: "Move it.",
        targetEntityId: 999,
        targetEntityName: "Invented",
        reassignBottleIds: [10],
        preserveSourceAsDistillery: false,
        metadataPatch: {},
        blockers: [],
        evidenceUrls: [],
      },
    });

    expect(result.verdict).toBe("manual_review");
    expect(result.targetEntityId).toBeNull();
    expect(result.reassignBottleIds).toEqual([]);
  });

  test("requires evidence URLs for metadata patches", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      decision: {
        verdict: "fix_entity_metadata",
        confidence: 90,
        rationale: "Looks like a distillery.",
        targetEntityId: null,
        targetEntityName: null,
        reassignBottleIds: [],
        preserveSourceAsDistillery: false,
        metadataPatch: {
          type: ["distiller"],
        },
        blockers: [],
        evidenceUrls: [],
      },
    });

    expect(result.verdict).toBe("manual_review");
    expect(result.metadataPatch).toEqual({});
  });
});
