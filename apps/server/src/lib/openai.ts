import config from "@peated/server/config";
import { logError, type SentryLogContexts } from "@peated/server/lib/log";
import { createOpenAIClient } from "@peated/server/lib/openaiClient";
import { startSpan } from "@sentry/node";
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

export function buildStructuredResponseSpanContext(
  pipelineName: string,
  model: string,
) {
  return {
    op: "gen_ai.invoke_workflow",
    name: `invoke_workflow ${pipelineName}`,
    attributes: {
      "gen_ai.operation.name": "invoke_workflow",
      "gen_ai.provider.name": "openai",
      "gen_ai.workflow.name": pipelineName,
      "gen_ai.request.model": model,
      "gen_ai.output.type": "json",
    },
  };
}

export async function getStructuredResponse<Schema extends ZodSchema<any>>(
  pipelineName: string,
  prompt: string | Message[],
  schema: Schema,
  fullSchema?: null,
  model?: string,
  logContext?: SentryLogContexts,
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
  logContext?: SentryLogContexts,
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
  logContext?: SentryLogContexts,
): Promise<z.infer<Schema> | z.infer<FullSchema> | null> {
  const openai = createOpenAIClient();

  const responseSchema = fullSchema ?? schema;
  const input = prompt;
  const inputMessages: Message[] = Array.isArray(prompt)
    ? prompt
    : [{ role: "user", content: prompt }];

  const response = await startSpan(
    buildStructuredResponseSpanContext(pipelineName, model),
    async (span) => {
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

      span.setAttribute("gen_ai.response.id", result.id);
      span.setAttribute("gen_ai.response.model", result.model);
      if (result.usage) {
        span.setAttribute(
          "gen_ai.usage.input_tokens",
          result.usage.input_tokens,
        );
        span.setAttribute(
          "gen_ai.usage.cache_read.input_tokens",
          result.usage.input_tokens_details.cached_tokens,
        );
        span.setAttribute(
          "gen_ai.usage.output_tokens",
          result.usage.output_tokens,
        );
        span.setAttribute(
          "gen_ai.usage.reasoning.output_tokens",
          result.usage.output_tokens_details.reasoning_tokens,
        );
      }

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
    return responseSchema.parse(structuredResponse);
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
