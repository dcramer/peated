import type OpenAI from "openai";
import { z } from "zod";
import { BottleExtractedDetailsSchema } from "./classifierTypes";
import { buildWhiskyLabelExtractorInstructions } from "./extractorInstructions";
import {
  getStableOpenAISettings,
  type OpenAIReasoningEffort,
} from "./openaiModelSettings";

const ResponseSchema = z.object({
  result: BottleExtractedDetailsSchema.nullable(),
  rawLabelText: z.string().trim().min(1).max(4000).nullable().default(null),
});

interface WhiskyLabelProviderResponse {
  id: string;
  model: string;
  output_text: string;
  service_tier?: string | null;
  usage?: {
    input_tokens: number;
    input_tokens_details: { cached_tokens: number };
    output_tokens: number;
    output_tokens_details: { reasoning_tokens: number };
    total_tokens: number;
  } | null;
}

export interface WhiskyLabelClient {
  responses: {
    create(
      input: Parameters<OpenAI["responses"]["create"]>[0],
    ): PromiseLike<WhiskyLabelProviderResponse>;
  };
}

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

export function createWhiskyLabelExtractor({
  client,
  model,
  reasoningEffort,
  imageModel = model,
  imageReasoningEffort = reasoningEffort,
  onImageExtractionMetadata,
}: {
  client: WhiskyLabelClient;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageModel?: string;
  imageReasoningEffort?: OpenAIReasoningEffort;
  onImageExtractionMetadata?: (metadata: WhiskyLabelExtractionMetadata) => void;
}) {
  return {
    extractFromImage: async (imageUrlOrBase64: string) =>
      extractFromImage({
        client,
        model: imageModel,
        reasoningEffort: imageReasoningEffort,
        imageUrlOrBase64,
        onMetadata: onImageExtractionMetadata,
      }),
    extractFromImageWithMetadata: async (imageUrlOrBase64: string) =>
      extractFromImageWithMetadata({
        client,
        model: imageModel,
        reasoningEffort: imageReasoningEffort,
        imageUrlOrBase64,
        onMetadata: onImageExtractionMetadata,
      }),
    extractFromText: async (label: string) =>
      extractFromText({
        client,
        model,
        reasoningEffort,
        label,
      }),
  };
}

export async function extractFromImage({
  client,
  model,
  reasoningEffort,
  imageUrlOrBase64,
  onMetadata,
}: {
  client: WhiskyLabelClient;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageUrlOrBase64: string;
  onMetadata?: (metadata: WhiskyLabelExtractionMetadata) => void;
}) {
  return (
    await extractFromImageWithMetadata({
      client,
      model,
      reasoningEffort,
      imageUrlOrBase64,
      onMetadata,
    })
  ).result;
}

export async function extractFromImageWithMetadata({
  client,
  model,
  reasoningEffort,
  imageUrlOrBase64,
  onMetadata,
}: {
  client: WhiskyLabelClient;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageUrlOrBase64: string;
  onMetadata?: (metadata: WhiskyLabelExtractionMetadata) => void;
}): Promise<WhiskyLabelExtractionResult> {
  const startedAt = performance.now();
  const response = await client.responses.create({
    model,
    instructions: buildWhiskyLabelExtractorInstructions({ mode: "image" }),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: imageUrlOrBase64,
            detail: "high",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ExtractedBottleDetails",
        schema: z.toJSONSchema(ResponseSchema),
      },
    },
    ...getStableOpenAISettings(model, reasoningEffort),
  });

  const metadata = {
    durationMs: performance.now() - startedAt,
    response: {
      id: response.id,
      model: response.model,
      serviceTier: response.service_tier ?? null,
    },
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          cachedInputTokens: response.usage.input_tokens_details.cached_tokens,
          outputTokens: response.usage.output_tokens,
          reasoningTokens:
            response.usage.output_tokens_details.reasoning_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null,
  };
  onMetadata?.(metadata);

  const { result, rawLabelText } = ResponseSchema.parse(
    JSON.parse(response.output_text),
  );
  return {
    result,
    rawLabelText,
    ...metadata,
  };
}

export async function extractFromText({
  client,
  model,
  reasoningEffort,
  label,
}: {
  client: WhiskyLabelClient;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  label: string;
}) {
  const response = await client.responses.create({
    model,
    instructions: buildWhiskyLabelExtractorInstructions({ mode: "text" }),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: label,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ExtractedBottleDetails",
        schema: z.toJSONSchema(ResponseSchema),
      },
    },
    ...getStableOpenAISettings(model, reasoningEffort),
  });

  const { result } = ResponseSchema.parse(JSON.parse(response.output_text));
  return result;
}
