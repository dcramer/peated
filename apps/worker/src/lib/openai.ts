import OpenAI from "openai";
import { type ZodSchema } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import config from "~/config";

const DEFAULT_MODEL = "gpt-4";

type Model = "gpt-3.5-turbo" | "gpt-4";

// TODO: fix the return type here
export async function getStructuredResponse<T extends ZodSchema<any>>(
  prompt: string,
  zodSchema: T,
  model: Model = DEFAULT_MODEL,
): Promise<any | null> {
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
        parameters: zodToJsonSchema(zodSchema),
      },
    ],
    temperature: 0,
  });

  const structuredResponse = JSON.parse(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completion.choices[0].message!.function_call!.arguments!,
  );
  return zodSchema.parse(structuredResponse);
}
