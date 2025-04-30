import config from "@peated/server/config";
import { logError } from "@peated/server/lib/log";
import { startSpan } from "@sentry/node";
import OpenAI from "openai";
import { type ZodSchema, type z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

// type Model = "gpt-3.5-turbo" | "gpt-4";

type Message = {
  role: "system" | "user";
  content: string;
};

const DEFAULT_MODEL: string = config.OPENAI_MODEL;

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

  const messages: Message[] = [
    {
      role: "system",
      content: [
        "Your job is to accurately describe information about the whiskey industry as if you were a whisky sommelier. You do not embellish descriptions, and instead focus on concise, professional responses.",
        `The output format should strictly follow JSON schema:\n${zodToJsonSchema(
          schema,
        )}`,
      ].join("\n"),
    },
  ];
  if (typeof prompt === "string") {
    messages.push({
      role: "user",
      content: prompt,
    });
  } else {
    messages.push(...prompt);
  }

  // https://wundergraph.com/blog/return_json_from_openai
  const completion = await startSpan(
    {
      op: "ai.run",
      name: "getStructuredResponse",
    },
    async (span) => {
      span.setAttribute("ai.pipeline.name", pipelineName);
      span.setAttribute("ai.input_messages", JSON.stringify(messages));
      span.setAttribute("ai.model_id", model);
      span.setAttribute("ai.streaming", false);

      const result = await openai.chat.completions.create(
        {
          model,
          response_format: {
            type: "json_object",
          },
          messages,
          temperature: 0,
        },
        // {
        //   timeout: 300,
        // },
      );

      if (result.usage) {
        span.setAttribute("ai.total_tokens.used", result.usage.total_tokens);
        span.setAttribute("ai.prompt_tokens.used", result.usage.prompt_tokens);
        span.setAttribute(
          "ai.completion_tokens.used",
          result.usage.completion_tokens,
        );
      }

      span.setAttribute("ai.responses", JSON.stringify(result.choices));

      return result;
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const output: string = completion.choices[0].message!.content || "";

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
          completionId: completion.id,
          ...completion.usage,
        },
      },
      {
        "messages.json": JSON.stringify(messages),
        "output.txt": output,
      },
    );
    throw err;
  }

  try {
    return (fullSchema || schema).parse(structuredResponse);
  } catch (err) {
    logError(
      err,
      {
        ...(logContext || {}),
        openai: {
          completionId: completion.id,
          ...completion.usage,
        },
      },
      {
        "messages.json": JSON.stringify(messages),
        "output.json": output,
      },
    );

    throw err;
  }
}
