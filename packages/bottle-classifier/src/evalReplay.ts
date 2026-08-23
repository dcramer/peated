import type { JsonValue } from "vitest-evals/harness";
import type { ToolRecording } from "vitest-evals/replay";
import { z } from "zod";

const WebSearchErrorSchema = z.object({ error: z.string() });
const WebSearchResultSchema = z.object({
  error: z.string().optional(),
  errors: z.array(WebSearchErrorSchema).optional(),
});

function getWebSearchError(result: JsonValue | undefined): string | null {
  const parsed = WebSearchResultSchema.safeParse(result);
  if (!parsed.success) {
    return null;
  }

  if (parsed.data.error) {
    return parsed.data.error;
  }

  return parsed.data.errors?.[0]?.error ?? null;
}

export function assertSuccessfulWebSearchReplay(
  result: JsonValue | undefined,
): void {
  const error = getWebSearchError(result);
  if (error) {
    throw new Error(
      `Web-search replay recordings must contain evidence, not an error: ${error}`,
    );
  }
}

export function sanitizeWebSearchRecording<
  TArgs extends JsonValue,
  TResult extends JsonValue,
>(recording: ToolRecording<TArgs, TResult>): ToolRecording<TArgs, TResult> {
  if (recording.error) {
    throw new Error(
      `Web-search replay recordings must contain evidence, not an error: ${recording.error.message}`,
    );
  }

  assertSuccessfulWebSearchReplay(recording.output);
  return recording;
}
