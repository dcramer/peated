/**
 * Peated-owned context envelope for the durable job boundary.
 *
 * Job handlers own validation of their `args`. This module carries only actor
 * and trace context across dispatch, then drops malformed context instead of
 * inferring authority. Preserve that fail-closed behavior under
 * `docs/policies/runtime-boundaries.md` and `docs/policies/background-work.md`.
 */
import { z } from "zod";
import { getCurrentActorContext } from "../lib/actorContext";
import {
  JobContextSchema,
  type JobArgs,
  type JobContext,
  type JobPayload,
  type QueuedJobInput,
} from "./types";

const QueuedJobDataSchema = z
  .object({
    args: z.record(z.string(), z.json()).optional(),
    context: JobContextSchema.catch({}).optional().default({}),
  })
  .strict();

export type QueuedJobData = {
  args?: JobPayload;
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
  args?: JobArgs,
  traceContext: JobContext["traceContext"] = {},
): QueuedJobData {
  return {
    args,
    context: buildJobContext(traceContext),
  };
}

/** Parse queued job data, dropping malformed context while preserving job args. */
export function parseQueuedJobData(
  input: QueuedJobInput | null | undefined,
): QueuedJobData {
  const result = QueuedJobDataSchema.safeParse(input);
  if (!result.success) {
    return {
      context: {},
    };
  }

  return {
    args: result.data.args,
    context: result.data.context,
  };
}
