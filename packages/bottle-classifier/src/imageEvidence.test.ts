import { describe, expect, test } from "vitest";
import {
  ImageBottleEvidenceSchema,
  ImageEvidenceExtractorOutputSchema,
} from "./imageEvidence";

const readablePhotoSuitability = {
  isSingleBottlePhoto: true,
  labelReadable: true,
  suitableAsTastingImage: true,
  suitableAsBottleImage: true,
};

describe("image evidence contract", () => {
  test("accepts representative OCR and vision evidence", () => {
    const parsed = ImageBottleEvidenceSchema.parse({
      sourceImageId: "pending-upload-1",
      sourceImageHash:
        "sha256:81d3d4bbd8a2f7d43f8350b7dbed6af804727c9a2a2969f0ee11f60f7fbfbb5f",
      extractors: [
        {
          kind: "ocr",
          model: "tesseract-5",
          confidence: 0.84,
          textSpans: [
            {
              text: "Ardbeg Uigeadail",
              confidence: 0.92,
              region: { x: 0.2, y: 0.18, width: 0.52, height: 0.12 },
            },
            {
              text: "54.2% VOL",
              confidence: 0.88,
            },
          ],
          observations: ["front label text is readable"],
        },
        {
          kind: "vision",
          model: "gpt-4.1-mini",
          confidence: 0.78,
          textSpans: [],
          observations: ["single front-facing bottle"],
        },
      ],
      fieldCandidates: {
        brand: {
          value: "Ardbeg",
          confidence: 0.96,
          sourceExtractorIndexes: [0],
        },
        expression: {
          value: "Uigeadail",
          confidence: 0.9,
          sourceExtractorIndexes: [0, 1],
        },
        abv: { value: 54.2, confidence: 0.88, sourceExtractorIndexes: [0] },
      },
      photoSuitability: readablePhotoSuitability,
      conflicts: [],
    });

    expect(parsed.fieldCandidates.brand?.value).toBe("Ardbeg");
    expect(parsed.extractors).toHaveLength(2);
  });

  test("accepts standalone extractor adapter output", () => {
    const parsed = ImageEvidenceExtractorOutputSchema.parse({
      kind: "vision",
      confidence: 0.65,
      observations: ["appears to be a whisky bottle"],
    });

    expect(parsed.textSpans).toEqual([]);
  });

  test("rejects invalid confidence values", () => {
    expect(() =>
      ImageBottleEvidenceSchema.parse({
        sourceImageId: "pending-upload-1",
        extractors: [
          {
            kind: "ocr",
            confidence: 1.2,
          },
        ],
        photoSuitability: readablePhotoSuitability,
      }),
    ).toThrow();
  });

  test("rejects malformed text regions", () => {
    expect(() =>
      ImageBottleEvidenceSchema.parse({
        sourceImageId: "pending-upload-1",
        extractors: [
          {
            kind: "ocr",
            confidence: 0.8,
            textSpans: [
              {
                text: "Springbank",
                confidence: 0.9,
                region: { x: 0.8, y: 0.2, width: 0.3, height: 0.1 },
              },
            ],
          },
        ],
        photoSuitability: readablePhotoSuitability,
      }),
    ).toThrow(/right image edge/);
  });

  test("rejects impossible bottle field values", () => {
    expect(() =>
      ImageBottleEvidenceSchema.parse({
        sourceImageId: "pending-upload-1",
        extractors: [
          {
            kind: "vision",
            confidence: 0.7,
          },
        ],
        fieldCandidates: {
          statedAge: { value: 140, confidence: 0.7 },
          abv: { value: 104, confidence: 0.7 },
        },
        photoSuitability: readablePhotoSuitability,
      }),
    ).toThrow();
  });
});
