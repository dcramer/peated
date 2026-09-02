import { processStorePriceMatchRetryRun } from "@peated/server/lib/storePriceMatchRetryRuns";
import type { JobPayload } from "@peated/server/worker/types";
import { z } from "zod";

export const ProcessStorePriceMatchRetryRunJobArgsSchema = z
  .object({
    runId: z.number().int().positive(),
  })
  .strict();

export default async (input: JobPayload) => {
  const { runId } = ProcessStorePriceMatchRetryRunJobArgsSchema.parse(input);

  await processStorePriceMatchRetryRun({ runId });
};
