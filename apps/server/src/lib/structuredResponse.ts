import { createLanguageModel } from "@peated/server/lib/aiSdkModels";
import { logError, type SentryLogContexts } from "@peated/server/lib/log";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { type z } from "zod";

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

/**
 * Asks the default model for data that matches `schema`. Output that does not
 * match is logged with the prompt and output attached, then thrown.
 *
 * Schema rule: every field is required, and `.nullable()` marks an unknown
 * value. A field with a default becomes optional in the JSON schema the model
 * sees, so the model may leave it out.
 */
export async function getStructuredResponse<T>({
  pipelineName,
  prompt,
  schema,
  logContext,
}: {
  pipelineName: string;
  prompt: string;
  schema: z.ZodType<T>;
  logContext?: SentryLogContexts;
}): Promise<T> {
  try {
    const result = await generateText({
      model: createLanguageModel(),
      instructions: GENERATION_PERSONA_PROMPT,
      prompt,
      output: Output.object({
        schema,
        name: `${pipelineName}_response`,
        description: `Structured output for the ${pipelineName} pipeline.`,
      }),
      providerOptions: { openai: { store: false } },
      telemetry: { functionId: pipelineName },
    });
    return result.output;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      logError(
        err,
        {
          ...logContext,
          model: {
            responseId: err.response?.id,
            finishReason: err.finishReason,
            inputTokens: err.usage?.inputTokens,
            outputTokens: err.usage?.outputTokens,
          },
        },
        { "prompt.txt": prompt, "output.txt": err.text ?? "" },
      );
    }
    throw err;
  }
}
