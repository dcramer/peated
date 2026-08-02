import type { JsonValue } from "vitest-evals/harness";
import type { ToolRecording } from "vitest-evals/replay";

function isWebSearchError(
  result: JsonValue | undefined,
): result is { error: string } {
  return (
    result !== undefined &&
    !Array.isArray(result) &&
    typeof result === "object" &&
    result !== null &&
    typeof result.error === "string"
  );
}

export function assertSuccessfulWebSearchReplay(
  result: JsonValue | undefined,
): void {
  if (isWebSearchError(result)) {
    throw new Error(
      `Web-search replay recordings must contain evidence, not an error: ${result.error}`,
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
