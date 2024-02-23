import { logError } from "@peated/server/lib/log";
import config from "@peated/worker/config";
import OpenAI from "openai";
import { type z, type ZodSchema } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

// type Model = "gpt-3.5-turbo" | "gpt-4";

const DEFAULT_MODEL: string = config.OPENAI_MODEL;

export async function getStructuredResponse<Schema extends ZodSchema<any>>(
  prompt: string,
  schema: Schema,
  fullSchema?: undefined | null,
  model?: string,
  logContext?: Record<string, Record<string, any>>,
): Promise<z.infer<Schema> | null>;
export async function getStructuredResponse<
  Schema extends ZodSchema<any>,
  FullSchema extends ZodSchema<any>,
>(
  prompt: string,
  schema: Schema,
  fullSchema: FullSchema,
  model?: string,
  logContext?: Record<string, Record<string, any>>,
): Promise<z.infer<FullSchema> | null>;
export async function getStructuredResponse<
  Schema extends ZodSchema<any>,
  FullSchema extends ZodSchema<any>,
>(
  prompt: string,
  schema: Schema,
  fullSchema: FullSchema | null = null,
  model = DEFAULT_MODEL,
  logContext?: Record<string, Record<string, any>>,
): Promise<z.infer<FullSchema> | null> {
  const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
  });

  // https://wundergraph.com/blog/return_json_from_openai
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: [
          "You are an expert in whiskey. Your job is to accurately describe information about the whiskey industry.",
          `The output format should implement the following JSON schema:\n${zodToJsonSchema(
            schema,
          )}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    // functions: [
    //   {
    //     name: "out",
    //     description:
    //       "This is the function that returns the result of the agent",
    //     parameters: zodToJsonSchema(schema),
    //   },
    // ],
    temperature: 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const output: string = completion.choices[0].message!.content || "";
  // const output = completion.choices[0].message!.function_call!.arguments!;

  let structuredResponse: any;
  try {
    structuredResponse = JSON.parse(output);
  } catch (err) {
    // likely a json parse error - so assume malformed
    logError(
      err,
      {
        ...logContext,
        openai: {
          completionId: completion.id,
          ...completion.usage,
        },
      },
      {
        "prompt.txt": prompt,
        "output.txt": output,
      },
    );
  }

  // no idea whats going on here, but robots arent that smart yet
  if (structuredResponse.description instanceof Array)
    structuredResponse.description = structuredResponse.description.join("");

  try {
    return (fullSchema || schema).parse(structuredResponse);
  } catch (err) {
    logError(
      err,
      {
        ...logContext,
        openai: {
          completionId: completion.id,
          ...completion.usage,
        },
      },
      {
        "prompt.txt": prompt,
        "output.json": output,
      },
    );

    return null;
  }
}
