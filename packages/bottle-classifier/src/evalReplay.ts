import type { JsonValue } from "vitest-evals/harness";
import type { ToolRecording } from "vitest-evals/replay";

function getWebSearchError(result: JsonValue | undefined): string | null {
  if (
    result === undefined ||
    Array.isArray(result) ||
    typeof result !== "object" ||
    result === null
  ) {
    return null;
  }

  if (typeof result.error === "string") {
    return result.error;
  }

  if (!Array.isArray(result.errors)) {
    return null;
  }

  for (const item of result.errors) {
    if (
      !Array.isArray(item) &&
      typeof item === "object" &&
      item !== null &&
      typeof item.error === "string"
    ) {
      return item.error;
    }
  }

  return null;
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
