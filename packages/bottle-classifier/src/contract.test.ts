import { describe, expect, test } from "vitest";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  buildBottleClassificationArtifacts,
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  getBottleCheckSourceEvidencePaths,
  isIgnoredBottleClassification,
} from "./contract";

describe("bottle-classifier contract", () => {
  test("parses the generic classifier input shape", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        id: "listing-1",
        name: "Glenmorangie Quinta Ruban 14-year-old",
        url: "https://example.com/products/quinta-ruban",
        currentBottleId: null,
      },
    });

    expect(parsed.reference.name).toBe("Glenmorangie Quinta Ruban 14-year-old");
    expect(parsed.candidateExpansion).toBe("open");
  });

  test("parses closed-set candidate expansion mode", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        name: "Warehouse Session (Batch 2)",
      },
      candidateExpansion: "initial_only",
    });

    expect(parsed.candidateExpansion).toBe("initial_only");
  });

  test("parses optional image evidence on classifier input", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        name: "Ardbeg Uigeadail",
      },
      extractedIdentity: {
        brand: "Ardbeg",
        expression: "Uigeadail",
      },
      imageEvidence: {
        sourceImageId: "pending-upload-1",
        extractors: [
          {
            kind: "ocr",
            confidence: 0.86,
            textSpans: [{ text: "Uigeadail", confidence: 0.91 }],
          },
        ],
        fieldCandidates: {
          brand: { value: "Ardbeg", confidence: 0.96 },
        },
        photoSuitability: {
          isSingleBottlePhoto: true,
          labelReadable: true,
          suitableAsTastingImage: true,
          suitableAsBottleImage: true,
        },
      },
      candidateExpansion: "initial_only",
    });

    expect(parsed.imageEvidence?.fieldCandidates.brand?.value).toBe("Ardbeg");
    expect(parsed.extractedIdentity?.category).toBeNull();
  });

  test("accepts local image data URLs only on image references", () => {
    const dataImageUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        name: "Local image",
        url: dataImageUrl,
        imageUrl: dataImageUrl,
      },
    });

    expect(parsed.reference.url).toBeNull();
    expect(parsed.reference.imageUrl).toBe(dataImageUrl);
  });

  test("rejects non-image data URLs on image references", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        name: "Local image",
        imageUrl: "data:text/plain;base64,SGVsbG8=",
      },
    });

    expect(parsed.reference.imageUrl).toBeNull();
  });

  test("derives source evidence paths from present input and artifact fields", () => {
    expect(
      getBottleCheckSourceEvidencePaths({
        intent: "resolve_reference",
        input: {
          reference: {
            id: "listing-1",
            name: "Example Bottle",
            url: null,
            imageUrl: "https://example.com/example-bottle.jpg",
            currentBottleId: null,
          },
        },
        artifacts: buildBottleClassificationArtifacts({
          extractedIdentity: {
            brand: "Example",
            bottler: null,
            expression: null,
            series: null,
            distillery: null,
            category: null,
            stated_age: null,
            abv: null,
            release_year: null,
            vintage_year: null,
            cask_strength: null,
            single_cask: null,
            cask_type: null,
            cask_size: null,
            cask_fill: null,
            edition: null,
          },
          imageEvidence: {
            sourceImageId: "image-1",
            extractors: [
              {
                kind: "ocr",
                confidence: 0.9,
                textSpans: [],
                observations: [],
              },
            ],
            fieldCandidates: {
              edition: { value: "Special", confidence: 0.8 },
            },
            photoSuitability: {
              isSingleBottlePhoto: true,
              labelReadable: true,
              suitableAsTastingImage: true,
              suitableAsBottleImage: true,
            },
            conflicts: [],
          },
        }),
      }),
    ).toEqual([
      "reference.id",
      "reference.name",
      "reference.imageUrl",
      "extractedIdentity.brand",
      "imageEvidence.fieldCandidates.edition",
    ]);
  });

  test("derives audit-note evidence from canonical artifacts", () => {
    const artifacts = buildBottleClassificationArtifacts({});

    expect(
      getBottleCheckSourceEvidencePaths({
        intent: "audit_bottle",
        input: {
          bottleId: 1,
          origin: "moderator",
          note: "Check the label.",
        },
        artifacts,
      }),
    ).toEqual(["audit.note"]);
  });

  test("derives only known reference evidence paths", () => {
    const reference = {
      name: "Example Bottle",
      currentBottleId: 42,
      unexpectedMetadata: "not source evidence",
    };

    expect(
      getBottleCheckSourceEvidencePaths({
        intent: "resolve_reference",
        input: { reference },
        artifacts: buildBottleClassificationArtifacts({}),
      }),
    ).toEqual(["reference.name", "reference.currentBottleId"]);
  });

  test("builds discriminated results with normalized artifacts", () => {
    const ignored = createIgnoredBottleClassification({
      reason: "non-whisky",
      artifacts: {},
    });
    const classified = createDecidedBottleClassification({
      decision: {
        action: "no_match",
        rationale: "Not enough identity evidence.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        proposedBottle: null,
      },
      artifacts: {
        imageEvidence: {
          sourceImageId: "pending-upload-1",
          extractors: [
            {
              kind: "vision",
              confidence: 0.8,
              textSpans: [],
              observations: [],
            },
          ],
          fieldCandidates: {},
          photoSuitability: {
            isSingleBottlePhoto: true,
            labelReadable: true,
            suitableAsTastingImage: true,
            suitableAsBottleImage: false,
          },
          conflicts: [],
        },
        candidates: [],
      },
    });

    expect(isIgnoredBottleClassification(ignored)).toBe(true);
    expect(ignored.proposedOperations).toEqual([]);
    expect(ignored.findings).toEqual([]);
    expect(BottleClassificationResultSchema.parse(classified)).toMatchObject({
      status: "classified",
      proposedOperations: [],
      findings: [],
      artifacts: {
        imageEvidence: {
          sourceImageId: "pending-upload-1",
        },
        candidates: [],
        searchEvidence: [],
      },
    });
  });

  test("rejects findings on ignored results", () => {
    const result = BottleClassificationResultSchema.safeParse({
      status: "ignored",
      reason: "non-whisky",
      proposedOperations: [],
      findings: [
        {
          scope: "other",
          summary: "This must not survive an ignored result.",
          evidenceRefs: [],
        },
      ],
      artifacts: {
        extractedIdentity: null,
        imageEvidence: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
        bottleContexts: [],
        entityContexts: [],
      },
    });

    expect(result.success).toBe(false);
  });
});
