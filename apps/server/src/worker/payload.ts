import { z } from "zod";
import { getCurrentActorContext } from "../lib/actorContext";
import { parseJobContext, type JobContext } from "./types";

const QueuedJobDataSchema = z
  .object({
    args: z.unknown().optional(),
    context: z.unknown().optional(),
  })
  .strict();

export type QueuedJobData = {
  args?: unknown;
  context: JobContext;
};

/** Build app-owned job context for direct and queued job dispatches. */
export function buildJobContext(
  traceContext: JobContext["traceContext"] = {},
): JobContext {
  return {
    traceContext,
    actor: getCurrentActorContext(),
  };
}

/** Build the serialized payload handed to the queue. */
export function buildQueuedJobData(
  args?: unknown,
  traceContext: JobContext["traceContext"] = {},
): QueuedJobData {
  return {
    args,
    context: buildJobContext(traceContext),
  };
}

/** Parse queued job data, dropping malformed context while preserving job args. */
export function parseQueuedJobData(input: unknown): QueuedJobData {
  const result = QueuedJobDataSchema.safeParse(input);
  if (!result.success) {
    return {
      context: {},
    };
  }

  return {
    args: result.data.args,
    context: parseJobContext(result.data.context),
  };
}
