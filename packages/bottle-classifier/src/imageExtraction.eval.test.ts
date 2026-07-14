import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { BottleExtractedDetails } from "./classifierTypes";
import { createEvalOpenAIClient, evalClassifierModel } from "./evalSupport";
import { createWhiskyLabelExtractor } from "./extractor";
import {
  IMAGE_EXTRACTION_EVAL_CASES,
  type ExtractedIdentityField,
  type ImageExtractionEvalCase,
} from "./imageExtraction.eval.fixtures";

function imageFileToDataUrl(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  const mimeType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
  const data = readFileSync(filename).toString("base64");
  return `data:${mimeType};base64,${data}`;
}

function normalizeEvalText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function getFieldValue(
  extractedIdentity: BottleExtractedDetails,
  field: ExtractedIdentityField,
) {
  return extractedIdentity[field];
}

function expectFieldValue(
  extractedIdentity: BottleExtractedDetails,
  field: ExtractedIdentityField,
  expectedValue: unknown,
) {
  const actual = getFieldValue(extractedIdentity, field);

  if (typeof expectedValue === "number") {
    expect(actual).toBeTypeOf("number");
    expect(actual as number).toBeCloseTo(expectedValue, 1);
    return;
  }

  expect(actual).toEqual(expectedValue);
}

function expectTextIncludes(actual: unknown, requiredText: string) {
  expect(normalizeEvalText(actual)).toContain(normalizeEvalText(requiredText));
}

function expectTextExcludes(actual: unknown, excludedText: string) {
  expect(normalizeEvalText(actual)).not.toContain(
    normalizeEvalText(excludedText),
  );
}

function assertExtractionExpectation(
  testCase: ImageExtractionEvalCase,
  extractedIdentity: BottleExtractedDetails,
) {
  for (const [field, expectedValue] of Object.entries(
    testCase.expected.fields ?? {},
  )) {
    expectFieldValue(
      extractedIdentity,
      field as ExtractedIdentityField,
      expectedValue,
    );
  }

  for (const textExpectation of testCase.expected.text ?? []) {
    const actual = getFieldValue(extractedIdentity, textExpectation.field);

    for (const requiredText of textExpectation.includes ?? []) {
      expectTextIncludes(actual, requiredText);
    }

    for (const excludedText of textExpectation.excludes ?? []) {
      expectTextExcludes(actual, excludedText);
    }
  }

  for (const textExpectation of testCase.expected.anyText ?? []) {
    const combined = textExpectation.fields
      .map((field) => getFieldValue(extractedIdentity, field))
      .join(" ");

    for (const requiredText of textExpectation.includes) {
      expectTextIncludes(combined, requiredText);
    }
  }

  for (const distillery of testCase.expected.distilleryIncludes ?? []) {
    const distilleries = extractedIdentity.distillery ?? [];
    expect(
      distilleries.some((value) =>
        normalizeEvalText(value).includes(normalizeEvalText(distillery)),
      ),
    ).toBe(true);
  }
}

describe.skipIf(!process.env.OPENAI_API_KEY)("image extraction evals", () => {
  const extractor = createWhiskyLabelExtractor({
    client: createEvalOpenAIClient(),
    model: evalClassifierModel,
  });

  test.for(IMAGE_EXTRACTION_EVAL_CASES)("$name", async (testCase) => {
    const extractedIdentity = await extractor.extractFromImage(
      imageFileToDataUrl(testCase.imagePath),
    );

    expect(extractedIdentity).not.toBeNull();
    assertExtractionExpectation(testCase, extractedIdentity!);
  });
});
