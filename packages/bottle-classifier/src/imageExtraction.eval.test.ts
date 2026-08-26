import { readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "vitest";
import { createHarness, describeEval } from "vitest-evals";
import { toJsonValue, type JsonValue } from "vitest-evals/harness";
import { z } from "zod";
import {
  BottleExtractedDetailsSchema,
  type BottleExtractedDetails,
} from "./classifierTypes";
import {
  buildEvalHarnessMeasurements,
  formatEvalUsageAnnotation,
} from "./evalMeasurements";
import {
  createEvalOpenAIClient,
  evalImageExtractionModel,
  evalImageExtractionReasoningEffort,
  hasEvalAIGatewayCredentials,
} from "./evalSupport";
import { withEvalModelCallCapture } from "./evalTelemetry";
import { createWhiskyLabelExtractor } from "./extractor";
import {
  IMAGE_EXTRACTION_EVAL_CASES,
  type ExtractedIdentityField,
  type ImageExtractionEvalCase,
} from "./imageExtraction.eval.fixtures";

const EXTRACTED_IDENTITY_FIELDS: ExtractedIdentityField[] = [
  "brand",
  "bottler",
  "expression",
  "series",
  "category",
  "stated_age",
  "abv",
  "release_year",
  "vintage_year",
  "bottling_year",
  "cask_strength",
  "single_cask",
  "edition",
];

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

type ExtractedIdentityValue = BottleExtractedDetails[ExtractedIdentityField];

function normalizeEvalText(value: ExtractedIdentityValue): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/['’]/g, "")
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
  expectedValue: ExtractedIdentityValue,
) {
  const actual = getFieldValue(extractedIdentity, field);
  const expectedNumber = z.number().safeParse(expectedValue);

  if (expectedNumber.success) {
    expect(z.number().parse(actual)).toBeCloseTo(expectedNumber.data, 1);
    return;
  }

  expect(actual).toEqual(expectedValue);
}

function expectTextIncludes(
  actual: ExtractedIdentityValue,
  requiredText: string,
) {
  expect(normalizeEvalText(actual)).toContain(normalizeEvalText(requiredText));
}

function expectTextExcludes(
  actual: ExtractedIdentityValue,
  excludedText: string,
) {
  expect(normalizeEvalText(actual)).not.toContain(
    normalizeEvalText(excludedText),
  );
}

function assertExtractionExpectation(
  testCase: ImageExtractionEvalCase,
  extractedIdentity: BottleExtractedDetails,
) {
  for (const field of EXTRACTED_IDENTITY_FIELDS) {
    const expectedValue = testCase.expected.fields?.[field];
    if (expectedValue !== undefined) {
      expectFieldValue(extractedIdentity, field, expectedValue);
    }
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

const imageExtractionHarness = createHarness<
  ImageExtractionEvalCase,
  JsonValue
>({
  name: "image-extraction",
  run: async ({ input }) => {
    const startedAt = performance.now();
    const { result: extractedIdentity, modelCalls } =
      await withEvalModelCallCapture(async () => {
        const extractor = createWhiskyLabelExtractor({
          client: createEvalOpenAIClient(),
          model: evalImageExtractionModel,
          reasoningEffort: evalImageExtractionReasoningEffort,
        });
        return await extractor.extractFromImage(
          imageFileToDataUrl(input.imagePath),
        );
      });
    const output = toJsonValue(extractedIdentity) ?? null;

    return {
      output,
      events: [
        {
          type: "message",
          role: "user",
          content: `Extract the whisky label in fixture ${input.name}.`,
        },
        { type: "message", role: "assistant", content: output },
      ],
      ...buildEvalHarnessMeasurements({
        model: evalImageExtractionModel,
        modelMetadata: null,
        reasoningEffort: evalImageExtractionReasoningEffort,
        totalMs: performance.now() - startedAt,
        modelCalls,
        trace: {
          name: "Image Extraction",
          operationName: "invoke_workflow",
        },
      }),
    };
  },
});

describeEval(
  "image extraction evals",
  {
    skipIf: () => !hasEvalAIGatewayCredentials,
    harness: imageExtractionHarness,
  },
  (it) => {
    it.for(IMAGE_EXTRACTION_EVAL_CASES)(
      "$name",
      async (testCase, { run, annotate }) => {
        const result = await run(testCase);
        await annotate(formatEvalUsageAnnotation(result.usage), "usage");
        const extractedIdentity = BottleExtractedDetailsSchema.nullable().parse(
          result.output,
        );

        expect(extractedIdentity).not.toBeNull();
        assertExtractionExpectation(testCase, extractedIdentity!);
      },
    );
  },
);
