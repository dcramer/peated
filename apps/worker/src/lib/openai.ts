import OpenAI from "openai";
import { type z, type ZodSchema } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import config from "~/config";
import { logError } from "./log";

type Model = "gpt-3.5-turbo" | "gpt-4";

const DEFAULT_MODEL: Model = "gpt-3.5-turbo";

export async function getStructuredResponse<Schema extends ZodSchema<any>>(
  prompt: string,
  schema: Schema,
  fullSchema?: undefined | null,
  model?: Model,
): Promise<z.infer<Schema> | null>;
export async function getStructuredResponse<
  Schema extends ZodSchema<any>,
  FullSchema extends ZodSchema<any>,
>(
  prompt: string,
  schema: Schema,
  fullSchema: FullSchema,
  model?: Model,
): Promise<z.infer<FullSchema> | null>;
export async function getStructuredResponse<
  Schema extends ZodSchema<any>,
  FullSchema extends ZodSchema<any>,
>(
  prompt: string,
  schema: Schema,
  fullSchema: FullSchema | null = undefined,
  model: Model = DEFAULT_MODEL,
): Promise<z.infer<FullSchema> | null> {
  const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  // https://wundergraph.com/blog/return_json_from_openai
  const completion = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
      {
        role: "user",
        content: "Set the result to the out function",
      },
    ],
    functions: [
      {
        name: "out",
        description:
          "This is the function that returns the result of the agent",
        parameters: zodToJsonSchema(schema),
      },
    ],
    temperature: 0,
  });

  // TODO: handle errors and bubble useful context to Sentry
  try {
    const structuredResponse = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      completion.choices[0].message!.function_call!.arguments!,
    );
    return (fullSchema || schema).parse(structuredResponse);
  } catch (err) {
    logError(
      err,
      {
        openAiUsage: {
          ...completion.usage,
        },
      },
      {
        "prompt.txt": prompt,
        "output.txt": `${
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          completion.choices[0].message!.function_call!.arguments
        }`,
      },
    );

    return null;
  }
}
