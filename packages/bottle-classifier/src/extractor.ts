import {
  generateText,
  jsonSchema,
  Output,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { createHash } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  BottleExtractedDetailsSchema,
  hasValidReleaseDate,
} from "./classifierTypes";
import { buildWhiskyLabelExtractorInstructions } from "./extractorInstructions";
import {
  getStableOpenAISettings,
  type OpenAIReasoningEffort,
} from "./openaiModelSettings";

const ResponseSchema = z.object({
  result: BottleExtractedDetailsSchema.nullable(),
  rawLabelText: z.string().trim().min(1).max(4000).nullable().default(null),
});
// The OpenAI helper builds a strict schema: every field required, nullable
// when unknown. The AI SDK's own conversion would make the label fields'
// defaults optional, and the model would then leave them out.
const ResponseFormat = zodTextFormat(ResponseSchema, "ExtractedBottleDetails");
const ResponseOutput = Output.object({
  schema: jsonSchema(ResponseFormat.schema),
  name: ResponseFormat.name,
});
const IMAGE_DETAIL = "high";

/** Returns the AI SDK model for a model name such as `openai/gpt-6-luna`. */
export type WhiskyLabelModel = (modelId: string) => LanguageModel;

/** Limits for a caller that cannot wait, such as photo lookup. */
export type WhiskyLabelRequestLimits = {
  timeoutMs: number;
  maxRetries: number;
};

export type WhiskyLabelExtractionMetadata = {
  durationMs: number;
  response: {
    id: string;
    model: string;
    serviceTier: string | null;
  };
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  } | null;
};

export type WhiskyLabelExtractionResult = WhiskyLabelExtractionMetadata &
  z.infer<typeof ResponseSchema>;

/**
 * Identifies everything that shapes an image label reading, so a saved reading
 * is reused only when the same extractor would produce it again.
 */
export function getImageLabelExtractionVersion({
  model,
  reasoningEffort,
}: {
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        runtime: "ai-sdk",
        model,
        settings: getStableOpenAISettings(model, reasoningEffort),
        instructions: buildWhiskyLabelExtractorInstructions({ mode: "image" }),
        format: ResponseFormat,
        detail: IMAGE_DETAIL,
      }),
    )
    .digest("hex");
}

const RawResponseSchema = z
  .object({ result: z.record(z.string(), z.unknown()).nullable() })
  .passthrough();
const RawDatePartSchema = z.number().nullish().catch(null);

function parseResponse(raw: z.infer<typeof RawResponseSchema>) {
  const result = raw.result;
  // Release month and day stay unknown unless they form a real date with the
  // release year. Models sometimes copy a bottling date into them; drop that
  // date instead of failing the whole label reading.
  if (
    result &&
    !hasValidReleaseDate(
      RawDatePartSchema.parse(result.release_year),
      RawDatePartSchema.parse(result.release_month),
      RawDatePartSchema.parse(result.release_day),
    )
  ) {
    result.release_month = null;
    result.release_day = null;
  }
  return ResponseSchema.parse(raw);
}

export function createWhiskyLabelExtractor({
  languageModel,
  model,
  reasoningEffort,
  imageModel = model,
  imageReasoningEffort = reasoningEffort,
  limits,
  onImageExtractionMetadata,
}: {
  languageModel: WhiskyLabelModel;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageModel?: string;
  imageReasoningEffort?: OpenAIReasoningEffort;
  limits?: WhiskyLabelRequestLimits;
  onImageExtractionMetadata?: (metadata: WhiskyLabelExtractionMetadata) => void;
}) {
  return {
    extractFromImage: async (imageUrlOrBase64: string) =>
      extractFromImage({
        languageModel,
        model: imageModel,
        reasoningEffort: imageReasoningEffort,
        imageUrlOrBase64,
        limits,
        onMetadata: onImageExtractionMetadata,
      }),
    extractFromImageWithMetadata: async (
      imageUrlOrBase64: string,
      { signal }: { signal?: AbortSignal } = {},
    ) =>
      extractFromImageWithMetadata({
        languageModel,
        model: imageModel,
        reasoningEffort: imageReasoningEffort,
        imageUrlOrBase64,
        limits,
        onMetadata: onImageExtractionMetadata,
        signal,
      }),
    extractFromText: async (label: string) =>
      extractFromText({
        languageModel,
        model,
        reasoningEffort,
        label,
        limits,
      }),
  };
}

type LabelReadingRequest = {
  languageModel: WhiskyLabelModel;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  limits?: WhiskyLabelRequestLimits;
  signal?: AbortSignal;
};

async function requestLabelReading(
  {
    languageModel,
    model,
    reasoningEffort,
    limits,
    signal,
  }: LabelReadingRequest,
  mode: "image" | "text",
  messages: ModelMessage[],
) {
  const settings = getStableOpenAISettings(model, reasoningEffort);
  return await generateText({
    model: languageModel(model),
    instructions: buildWhiskyLabelExtractorInstructions({ mode }),
    messages,
    output: ResponseOutput,
    temperature: settings.temperature,
    reasoning: settings.reasoning?.effort,
    timeout: limits?.timeoutMs,
    maxRetries: limits?.maxRetries,
    abortSignal: signal,
    providerOptions: { openai: { store: false } },
    // Classifier rule (packages/bottle-classifier/AGENTS.md): no image bytes
    // in traces. Photo lookup reads members' own photos, so its label
    // readings stay out too.
    telemetry: {
      functionId: `whisky_label_${mode}`,
      recordInputs: false,
      recordOutputs: false,
    },
  });
}

export async function extractFromImage(
  input: LabelReadingRequest & {
    imageUrlOrBase64: string;
    onMetadata?: (metadata: WhiskyLabelExtractionMetadata) => void;
  },
) {
  return (await extractFromImageWithMetadata(input)).result;
}

export async function extractFromImageWithMetadata({
  imageUrlOrBase64,
  onMetadata,
  ...request
}: LabelReadingRequest & {
  imageUrlOrBase64: string;
  onMetadata?: (metadata: WhiskyLabelExtractionMetadata) => void;
}): Promise<WhiskyLabelExtractionResult> {
  const startedAt = performance.now();
  const response = await requestLabelReading(request, "image", [
    {
      role: "user",
      content: [
        {
          type: "image",
          image: imageUrlOrBase64,
          providerOptions: { openai: { imageDetail: IMAGE_DETAIL } },
        },
      ],
    },
  ]);

  const usage = response.usage;
  const metadata: WhiskyLabelExtractionMetadata = {
    durationMs: performance.now() - startedAt,
    response: {
      id: response.response.id,
      model: response.response.modelId,
      serviceTier: null,
    },
    usage:
      usage.inputTokens === undefined || usage.outputTokens === undefined
        ? null
        : {
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
            outputTokens: usage.outputTokens,
            reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? 0,
            totalTokens:
              usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
          },
  };
  onMetadata?.(metadata);

  const { result, rawLabelText } = parseResponse(
    RawResponseSchema.parse(response.output),
  );
  return {
    result,
    rawLabelText,
    ...metadata,
  };
}

export async function extractFromText({
  label,
  ...request
}: LabelReadingRequest & { label: string }) {
  const response = await requestLabelReading(request, "text", [
    { role: "user", content: [{ type: "text", text: label }] },
  ]);

  const { result } = parseResponse(RawResponseSchema.parse(response.output));
  return result;
}
