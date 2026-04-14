import type OpenAI from "openai";
import { z } from "zod";
import { BottleExtractedDetailsSchema } from "./classifierTypes";
import { buildWhiskyLabelExtractorInstructions } from "./instructions";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";

const ResponseSchema = z.object({
  result: BottleExtractedDetailsSchema.nullable(),
});

export function createWhiskyLabelExtractor({
  client,
  model,
}: {
  client: OpenAI;
  model: string;
}) {
  return {
    extractFromImage: async (imageUrlOrBase64: string) =>
      extractFromImage({
        client,
        model,
        imageUrlOrBase64,
      }),
    extractFromText: async (label: string) =>
      extractFromText({
        client,
        model,
        label,
      }),
  };
}

export async function extractFromImage({
  client,
  model,
  imageUrlOrBase64,
}: {
  client: OpenAI;
  model: string;
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
            detail: "auto",
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
    ...getDeterministicOpenAISettings(model),
  });

  const { result } = ResponseSchema.parse(JSON.parse(response.output_text));
  return result;
}

export async function extractFromText({
  client,
  model,
  label,
}: {
  client: OpenAI;
  model: string;
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
    ...getDeterministicOpenAISettings(model),
  });

  const { result } = ResponseSchema.parse(JSON.parse(response.output_text));
  return result;
}
