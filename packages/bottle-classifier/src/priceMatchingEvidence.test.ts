import { describe, expect, test } from "vitest";
import type {
  BottleCandidate,
  BottleExtractedDetails,
  BottleSearchEvidence,
} from "./classifierTypes";
import { classifySearchResultSource } from "./identityEvidenceCore";
import {
  agentActionRiskClass,
  type AutomationTierInput,
  deriveAutomationTier,
  getExistingMatchIdentityConflicts,
  hasSupportiveWebEvidenceForExistingMatch,
  isPlainAgeBottleMatchEligibleForVerification,
} from "./priceMatchingEvidence";

function buildExtractedLabel(
  overrides: Partial<BottleExtractedDetails> = {},
): BottleExtractedDetails {
  return {
    brand: "Example Distillery",
    bottler: null,
    expression: "Port Cask",
    series: null,
    distillery: ["Example Distillery"],
    category: "single_malt",
    stated_age: 10,
    abv: 58.4,
    release_year: null,
    vintage_year: null,
    cask_strength: null,
    single_cask: null,
    cask_type: null,
    cask_size: null,
    cask_fill: null,
    edition: null,
    ...overrides,
  };
}

function buildBottleCandidate(
  candidate: Pick<BottleCandidate, "bottleId" | "fullName"> &
    Partial<BottleCandidate>,
): BottleCandidate {
  return {
    alias: null,
    brand: null,
    bottler: null,
    series: null,
    distillery: [],
    category: null,
    statedAge: null,
    edition: null,
    caskStrength: null,
    singleCask: null,
    caskType: null,
    caskSize: null,
    caskFill: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    score: null,
    source: [],
    ...candidate,
  };
}

function buildSearchEvidence(
  evidence: Partial<BottleSearchEvidence>,
): BottleSearchEvidence {
  return {
    provider: "openai",
    query: "test query",
    summary: null,
    results: [],
    ...evidence,
  };
}

describe("priceMatchingEvidence", () => {
  test("ignores optional cask metadata but keeps cask flags decisive for plain-age verification", () => {
    const target = buildBottleCandidate({
      bottleId: 1,
      fullName: "Example Distillery 10-year-old",
      brand: "Example Distillery",
      statedAge: 10,
    });
    const extractedLabel = buildExtractedLabel({
      expression: null,
      stated_age: 10,
      abv: null,
    });
    const input = {
      target,
      candidates: [target],
      extractedLabel,
      referenceName: "Example Distillery 10-year-old",
    };

    expect(isPlainAgeBottleMatchEligibleForVerification(input)).toBe(true);

    for (const caskSpecificLabel of [
      { cask_type: "pedro_ximenez" as const },
      { cask_size: "butt" as const },
      { cask_fill: "2nd_fill" as const },
    ]) {
      expect(
        isPlainAgeBottleMatchEligibleForVerification({
          ...input,
          extractedLabel: {
            ...extractedLabel,
            ...caskSpecificLabel,
          },
        }),
      ).toBe(true);
    }

    for (const caskSpecificTarget of [
      { caskType: "pedro_ximenez" as const },
      { caskSize: "butt" as const },
      { caskFill: "2nd_fill" as const },
    ]) {
      const candidate = {
        ...target,
        ...caskSpecificTarget,
      };
      expect(
        isPlainAgeBottleMatchEligibleForVerification({
          ...input,
          target: candidate,
          candidates: [candidate],
        }),
      ).toBe(true);
    }

    for (const decisiveLabel of [
      { cask_strength: true as const },
      { single_cask: true as const },
    ]) {
      expect(
        isPlainAgeBottleMatchEligibleForVerification({
          ...input,
          extractedLabel: {
            ...extractedLabel,
            ...decisiveLabel,
          },
        }),
      ).toBe(false);
    }

    for (const decisiveTarget of [
      { caskStrength: true as const },
      { singleCask: true as const },
    ]) {
      const candidate = { ...target, ...decisiveTarget };
      expect(
        isPlainAgeBottleMatchEligibleForVerification({
          ...input,
          target: candidate,
          candidates: [candidate],
        }),
      ).toBe(false);
    }
  });

  test("does not report optional cask metadata conflicts while retaining cask flag conflicts", () => {
    expect(
      getExistingMatchIdentityConflicts({
        target: buildBottleCandidate({
          bottleId: 4,
          fullName: "Example Distillery Reserve",
          brand: "Example Distillery",
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "refill",
          caskStrength: true,
          singleCask: false,
        }),
        extractedLabel: buildExtractedLabel({
          expression: "Reserve",
          stated_age: null,
          abv: null,
          cask_type: "oloroso",
          cask_size: "hogshead",
          cask_fill: "1st_fill",
          cask_strength: false,
          single_cask: true,
        }),
      }),
    ).toEqual([
      "candidate cask-strength flag conflicts with extracted label",
      "candidate single-cask flag conflicts with extracted label",
    ]);
  });

  test("treats agent-supported external evidence as support when it validates an omitted canonical trait", () => {
    const supported = hasSupportiveWebEvidenceForExistingMatch({
      sourceUrl: "https://shop.example/wild-turkey-rare-breed-rye",
      target: buildBottleCandidate({
        bottleId: 1,
        fullName: "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
        brand: "Wild Turkey",
        distillery: ["Wild Turkey"],
        category: "rye",
        caskStrength: true,
      }),
      extractedLabel: buildExtractedLabel({
        brand: "Wild Turkey",
        expression: "Rare Breed",
        distillery: ["Wild Turkey"],
        category: "rye",
        stated_age: null,
        abv: null,
      }),
      searchEvidence: [
        buildSearchEvidence({
          query: '"Wild Turkey Rare Breed Rye" barrel proof',
          summary:
            "Wild Turkey says Rare Breed Rye is bottled at barrel proof.",
          results: [
            {
              title:
                "What is Rye Whiskey & What Makes it So Special? | Wild Turkey",
              url: "https://www.wildturkeybourbon.com/en-us/latest-news/what-is-rye-whiskey/",
              domain: "wildturkeybourbon.com",
              description:
                "Wild Turkey Rare Breed Rye is bottled at barrel proof.",
              extraSnippets: [],
            },
          ],
        }),
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(supported).toBe(true);
  });

  test("does not treat off-origin retailer evidence as existing-match support", () => {
    const supported = hasSupportiveWebEvidenceForExistingMatch({
      sourceUrl: "https://shop.example/wild-turkey-rare-breed-rye",
      target: buildBottleCandidate({
        bottleId: 1,
        fullName: "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
        brand: "Wild Turkey",
        distillery: ["Wild Turkey"],
        category: "rye",
        caskStrength: true,
      }),
      extractedLabel: buildExtractedLabel({
        brand: "Wild Turkey",
        expression: "Rare Breed",
        distillery: ["Wild Turkey"],
        category: "rye",
        stated_age: null,
        abv: null,
      }),
      searchEvidence: [
        buildSearchEvidence({
          query: '"Wild Turkey Rare Breed Rye" barrel proof',
          summary:
            "Total Wine lists Wild Turkey Rare Breed Rye as barrel proof.",
          results: [
            {
              title: "Wild Turkey Rare Breed Barrel-Proof Rye Whiskey",
              url: "https://www.totalwine.com/spirits/american-whiskey/rye-whiskey/wild-turkey-rare-breed-rye/p/222404750",
              domain: "totalwine.com",
              description:
                "Retailer listing for Wild Turkey Rare Breed Barrel-Proof Rye Whiskey.",
              extraSnippets: [],
            },
          ],
        }),
      ],
    });

    expect(supported).toBe(false);
  });

  test("classifies search results only by origin relation", () => {
    expect(
      classifySearchResultSource({
        result: {
          title: "Wild Turkey fan notes",
          url: "https://wildturkeyfans.example/rare-breed-rye",
          domain: "wildturkeyfans.example",
          description: "Rare Breed Rye is bottled at barrel proof.",
          extraSnippets: [],
        },
        sourceUrl: "https://shop.example/wild-turkey-rare-breed-rye",
      }),
    ).toBe("external");

    expect(
      classifySearchResultSource({
        result: {
          title: "Shop listing",
          url: "https://shop.example/example-distillery-port-cask",
          domain: "shop.example",
          description: "Retailer listing for Example Distillery Port Cask.",
          extraSnippets: [],
        },
        sourceUrl: "https://shop.example/example-distillery-port-cask",
      }),
    ).toBe("origin_retailer");
  });

  test("does not treat evidence as supportive when it confirms only the generic parent and not the missing edition", () => {
    const supported = hasSupportiveWebEvidenceForExistingMatch({
      sourceUrl: "https://shop.example/glenmorangie-quinta-ruban-14",
      target: buildBottleCandidate({
        bottleId: 2,
        fullName: "Glenmorangie 14-year-old Quinta Ruban - 4th Edition",
        brand: "Glenmorangie",
        distillery: ["Glenmorangie"],
        statedAge: 14,
        edition: "4th Edition",
        abv: 46,
      }),
      extractedLabel: buildExtractedLabel({
        brand: "Glenmorangie",
        expression: "Quinta Ruban",
        distillery: ["Glenmorangie"],
        category: "single_malt",
        stated_age: 14,
        abv: null,
        edition: null,
      }),
      searchEvidence: [
        buildSearchEvidence({
          query: '"Glenmorangie Quinta Ruban 14 Years Old"',
          summary:
            "Glenmorangie's official page confirms The Quinta Ruban 14 Years Old at 46% ABV.",
          results: [
            {
              title: "Glenmorangie The Quinta Ruban 14 Years Old",
              url: "https://www.glenmorangie.com/en-us/products/the-quinta-ruban",
              domain: "glenmorangie.com",
              description:
                "The official Glenmorangie page confirms Quinta Ruban 14 Years Old at 46% ABV.",
              extraSnippets: [],
            },
          ],
        }),
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(supported).toBe(false);
  });

  test("reports material candidate conflicts from extracted identity", () => {
    expect(
      getExistingMatchIdentityConflicts({
        target: buildBottleCandidate({
          bottleId: 3,
          fullName: "Example Distillery Port Cask 10 Year",
          brand: "Example Distillery",
          distillery: ["Example Distillery"],
          category: "single_malt",
          statedAge: 12,
          abv: 46,
        }),
        extractedLabel: buildExtractedLabel({
          stated_age: 10,
          abv: 58.4,
        }),
      }),
    ).toEqual(
      expect.arrayContaining([
        "candidate ABV materially conflicts with extracted label",
      ]),
    );
  });

  test("does not treat the legacy generic spirit category as an existing-match conflict", () => {
    expect(
      getExistingMatchIdentityConflicts({
        target: buildBottleCandidate({
          bottleId: 13025,
          fullName: "Shibui Grain Select",
          brand: "Shibui",
          category: "spirit",
          source: ["brand", "exact"],
        }),
        extractedLabel: buildExtractedLabel({
          brand: "Shibui",
          expression: "Grain Select",
          distillery: [],
          category: "single_grain",
          stated_age: null,
          abv: null,
        }),
      }),
    ).not.toContain("candidate category conflicts with extracted label");
  });
});

function buildTierInput(
  overrides: Partial<AutomationTierInput> = {},
): AutomationTierInput {
  return {
    actionRiskClass: "match",
    hasUnresolvedRisks: false,
    webEvidence: "not_used",
    hasMatchTarget: true,
    reaffirmsCurrentAssignment: false,
    replacesCurrentAssignment: false,
    hasExactAliasAnchor: false,
    hasDeterministicAnchor: false,
    hasPrimaryLabelOrImageEvidence: false,
    ...overrides,
  };
}

describe("agentActionRiskClass", () => {
  test.each([
    ["match", "match"],
    ["create_bottle", "create"],
    ["no_match", "none"],
  ] as const)("maps %s to %s", (action, expected) => {
    expect(agentActionRiskClass(action)).toBe(expected);
  });
});

describe("deriveAutomationTier", () => {
  describe("model veto", () => {
    test("any unresolved risk forces review regardless of anchors", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            hasUnresolvedRisks: true,
            reaffirmsCurrentAssignment: true,
            hasDeterministicAnchor: true,
            hasExactAliasAnchor: true,
            hasPrimaryLabelOrImageEvidence: true,
            webEvidence: "supportive",
          }),
        ),
      ).toBe("review");
    });

    test("unresolved risk forces review for creates too", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            actionRiskClass: "create",
            hasUnresolvedRisks: true,
            webEvidence: "supportive",
            hasPrimaryLabelOrImageEvidence: true,
          }),
        ),
      ).toBe("review");
    });
  });

  describe("match risk class", () => {
    test("no match target routes to review", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            hasMatchTarget: false,
            reaffirmsCurrentAssignment: true,
          }),
        ),
      ).toBe("review");
    });

    test("replacing a different current assignment is a correction, not a verify", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            replacesCurrentAssignment: true,
            hasDeterministicAnchor: true,
          }),
        ),
      ).toBe("review");
    });

    test("current-assignment reaffirmation anchors an auto match", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({ reaffirmsCurrentAssignment: true }),
        ),
      ).toBe("auto");
    });

    test("deterministic anchor (exact_cask / SMWS / plain-age) autos", () => {
      expect(
        deriveAutomationTier(buildTierInput({ hasDeterministicAnchor: true })),
      ).toBe("auto");
    });

    test("exact alias anchor autos", () => {
      expect(
        deriveAutomationTier(buildTierInput({ hasExactAliasAnchor: true })),
      ).toBe("auto");
    });

    test("primary label/image evidence anchors an auto match", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({ hasPrimaryLabelOrImageEvidence: true }),
        ),
      ).toBe("auto");
    });

    test("supportive web evidence anchors an auto match", () => {
      expect(
        deriveAutomationTier(buildTierInput({ webEvidence: "supportive" })),
      ).toBe("auto");
    });

    test("webEvidence=not_needed anchors an auto match (clear local match, no risks)", () => {
      expect(
        deriveAutomationTier(buildTierInput({ webEvidence: "not_needed" })),
      ).toBe("auto");
    });

    test("webEvidence=not_needed does not override the model veto", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            webEvidence: "not_needed",
            hasUnresolvedRisks: true,
          }),
        ),
      ).toBe("review");
    });

    test.each(["not_used", "weak", "conflicting"] as const)(
      "unanchored match with webEvidence=%s routes to review",
      (webEvidence) => {
        expect(deriveAutomationTier(buildTierInput({ webEvidence }))).toBe(
          "review",
        );
      },
    );
  });

  describe("create risk class", () => {
    test("supportive web evidence autos a create", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            actionRiskClass: "create",
            webEvidence: "supportive",
          }),
        ),
      ).toBe("auto");
    });

    test("deterministic anchor autos a create", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            actionRiskClass: "create",
            hasDeterministicAnchor: true,
          }),
        ),
      ).toBe("auto");
    });

    test("primary label/image evidence autos a create", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            actionRiskClass: "create",
            hasPrimaryLabelOrImageEvidence: true,
          }),
        ),
      ).toBe("auto");
    });

    // `not_needed` anchors a match but must NOT rescue a create: writing new
    // canonical identity needs concrete support, not the absence of a search.
    test.each(["not_needed", "not_used", "weak", "conflicting"] as const)(
      "unsupported create with webEvidence=%s routes to review",
      (webEvidence) => {
        expect(
          deriveAutomationTier(
            buildTierInput({ actionRiskClass: "create", webEvidence }),
          ),
        ).toBe("review");
      },
    );

    test("match anchors do not rescue an unsupported create", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            actionRiskClass: "create",
            reaffirmsCurrentAssignment: true,
            hasExactAliasAnchor: true,
            webEvidence: "weak",
          }),
        ),
      ).toBe("review");
    });
  });

  describe("none risk class", () => {
    test("no_match / unclassified always routes to review", () => {
      expect(
        deriveAutomationTier(
          buildTierInput({
            actionRiskClass: "none",
            hasDeterministicAnchor: true,
            hasPrimaryLabelOrImageEvidence: true,
            webEvidence: "supportive",
          }),
        ),
      ).toBe("review");
    });
  });
});
