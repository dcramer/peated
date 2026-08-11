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
  test("uses the known name for a brand-assignment target", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      advice: {
        kind: "brand_assignment_issue",
        summary: "Canadian Club probably owns the reviewed Bottles.",
        targetEntityId: 2,
        evidenceUrls: [],
      },
    });

    expect(result).toMatchObject({
      kind: "brand_assignment_issue",
      targetEntityId: 2,
    });
  });

  test("uses insufficient evidence for an unknown target id", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      advice: {
        kind: "possible_duplicate",
        summary: "The subject could duplicate another Entity.",
        targetEntityId: 999,
        evidenceUrls: [],
      },
    });

    expect(result.kind).toBe("insufficient_evidence");
    expect(result.targetEntityId).toBeNull();
    expect(result.summary).toContain(
      "Target Entity 999 was not present in local evidence.",
    );
  });

  test("requires an evidence URL for metadata advice", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      advice: {
        kind: "metadata_issue",
        summary: "The subject could be a distillery.",
        targetEntityId: null,
        evidenceUrls: [],
      },
    });

    expect(result.kind).toBe("insufficient_evidence");
    expect(result.summary).toContain(
      "Metadata advice requires an authoritative evidence URL.",
    );
  });

  test("removes a target from advice that does not use one", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      advice: {
        kind: "no_issue",
        summary: "The subject is a valid Entity.",
        targetEntityId: 2,
        evidenceUrls: [],
      },
    });

    expect(result).toMatchObject({
      kind: "no_issue",
      targetEntityId: null,
    });
  });

  test("removes evidence URLs that the server did not collect", () => {
    const result = finalizeEntityClassification({
      reference,
      artifacts: buildEntityClassificationArtifacts({}),
      advice: {
        kind: "possible_duplicate",
        summary: "The subject could duplicate Canadian Club.",
        targetEntityId: 2,
        evidenceUrls: [
          "https://www.canadianclub.com/",
          "https://invented.example/",
        ],
      },
    });

    expect(result.evidenceUrls).toEqual(["https://www.canadianclub.com/"]);
  });
});
