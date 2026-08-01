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
});

export function createWhiskyLabelExtractor({
  client,
  model,
  reasoningEffort,
}: {
  client: OpenAI;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
}) {
  return {
    extractFromImage: async (imageUrlOrBase64: string) =>
      extractFromImage({
        client,
        model,
        reasoningEffort,
        imageUrlOrBase64,
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
}: {
  client: OpenAI;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageUrlOrBase64: string;
}) {
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

  const { result } = ResponseSchema.parse(JSON.parse(response.output_text));
  return result;
}

export async function extractFromText({
  client,
  model,
  reasoningEffort,
  label,
}: {
  client: OpenAI;
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
