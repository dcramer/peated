import config from "@peated/server/config";
import { ExtractedBottleDetailsSchema } from "@peated/server/schemas";
import OpenAI from "openai";
import { z } from "zod";
import { buildWhiskyLabelExtractorInstructions } from "./guidance";

const Response = z.object({
  result: ExtractedBottleDetailsSchema.nullable(),
});

function createOpenAIClient() {
  return new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });
}

export const extractFromImage = async (imageUrlOrBase64: string) => {
  const client = createOpenAIClient();

  const response = await client.responses.create({
    model: config.OPENAI_MODEL,
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
        schema: z.toJSONSchema(Response),
      },
    },
    temperature: 0,
  });

  const { result } = JSON.parse(response.output_text);
  return result;
};

export const extractFromText = async (label: string) => {
  const client = createOpenAIClient();

  const response = await client.responses.create({
    model: config.OPENAI_MODEL,
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
        schema: z.toJSONSchema(Response),
      },
    },
    temperature: 0,
  });

  const { result } = JSON.parse(response.output_text);
  return result;
};
