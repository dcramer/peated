import config from "@peated/server/config";
import { logError } from "@peated/server/lib/log";
import { startSpan } from "@sentry/node";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { type ZodSchema, type z } from "zod";

type Message = {
  role: "developer" | "system" | "user";
  content: string;
};

const DEFAULT_MODEL: string = config.OPENAI_MODEL;

export const GENERATION_PERSONA_PROMPT = [
  "<persona>",
  "You are a whisky reference editor for a structured spirits database.",
  "</persona>",
  "<style>",
  "Write concise, professional copy grounded in broadly established facts.",
  "</style>",
  "<rules>",
  "Use supplied input as context, but do not present it as an independent discovery.",
  "Do not invent dates, websites, producer relationships, regulations, cask details, tasting notes, or other specifics.",
  "If something is uncertain or unsupported, return null or omit the field instead of guessing.",
  'If the subject is in Scotland, use the spelling "whisky".',
  "Return only schema-conformant structured data.",
  "</rules>",
].join("\n");

export async function getStructuredResponse<Schema extends ZodSchema<any>>(
  pipelineName: string,
  prompt: string | Message[],
  schema: Schema,
  fullSchema?: undefined | null,
  model?: string,
  logContext?: Record<string, Record<string, any>>,
): Promise<z.infer<Schema> | null>;
export async function getStructuredResponse<
  Schema extends ZodSchema<any>,
  FullSchema extends ZodSchema<any>,
>(
  pipelineName: string,
  prompt: string | Message[],
  schema: Schema,
  fullSchema: FullSchema,
  model?: string,
  logContext?: Record<string, Record<string, any>>,
): Promise<z.infer<FullSchema> | null>;
export async function getStructuredResponse<
  Schema extends ZodSchema<any>,
  FullSchema extends ZodSchema<any>,
>(
  pipelineName: string,
  prompt: string | Message[],
  schema: Schema,
  fullSchema: FullSchema | null = null,
  model = DEFAULT_MODEL,
  logContext?: Record<string, Record<string, any>>,
): Promise<z.infer<FullSchema> | null> {
  const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });

  const responseSchema = (fullSchema || schema) as ZodSchema<any>;
  const input = typeof prompt === "string" ? prompt : prompt;
  const inputMessages: Message[] =
    typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

  const response = await startSpan(
    {
      op: "ai.run",
      name: "getStructuredResponse",
    },
    async (span) => {
      span.setAttribute("ai.pipeline.name", pipelineName);
      span.setAttribute("ai.instructions", GENERATION_PERSONA_PROMPT);
      span.setAttribute("ai.input_messages", JSON.stringify(inputMessages));
      span.setAttribute("ai.model_id", model);
      span.setAttribute("ai.streaming", false);

      const result = await openai.responses.create({
        model,
        instructions: GENERATION_PERSONA_PROMPT,
        input,
        text: {
          format: zodTextFormat(responseSchema, `${pipelineName}_response`, {
            description: `Structured output for the ${pipelineName} pipeline.`,
          }),
        },
        temperature: 0,
      });

      if (result.usage) {
        span.setAttribute("ai.total_tokens.used", result.usage.total_tokens);
        span.setAttribute("ai.prompt_tokens.used", result.usage.input_tokens);
        span.setAttribute(
          "ai.completion_tokens.used",
          result.usage.output_tokens,
        );
        span.setAttribute(
          "ai.reasoning_tokens.used",
          result.usage.output_tokens_details.reasoning_tokens,
        );
      }

      span.setAttribute("ai.responses", JSON.stringify(result.output));

      return result;
    },
  );

  const output = response.output_text || "";

  if (!output) {
    const err = new Error("OpenAI returned empty structured output");
    logError(
      err,
      {
        ...(logContext || {}),
        openai: {
          completionId: response.id,
          ...response.usage,
        },
      },
      {
        "messages.json": JSON.stringify(inputMessages),
        "response.json": JSON.stringify(response.output),
      },
    );
    throw err;
  }

  let structuredResponse: any;
  try {
    structuredResponse = JSON.parse(output);
  } catch (err) {
    // likely a json parse error - so assume malformed
    logError(
      err,
      {
        ...(logContext || {}),
        openai: {
          completionId: response.id,
          ...response.usage,
        },
      },
      {
        "messages.json": JSON.stringify(inputMessages),
        "output.txt": output,
      },
    );
    throw err;
  }

  try {
    return responseSchema.parse(structuredResponse) as z.infer<FullSchema>;
  } catch (err) {
    logError(
      err,
      {
        ...(logContext || {}),
        openai: {
          completionId: response.id,
          ...response.usage,
        },
      },
      {
        "messages.json": JSON.stringify(inputMessages),
        "output.json": output,
      },
    );

    throw err;
  }
}
