import {
  executeScraperRun,
  type ScraperRunExecutionResult,
} from "@peated/server/scraper";
import type { JobsOptions } from "bullmq";
import { z } from "zod";
import type { JobPayload } from "../types";

const InputSchema = z.object({ runId: z.number().int().positive() }).strict();

export type RunScraperServices = {
  executeRun: (
    input: Parameters<typeof executeScraperRun>[0],
  ) => Promise<ScraperRunExecutionResult>;
  enqueueRun: (runId: number, options: JobsOptions) => Promise<void>;
};

const defaultServices: RunScraperServices = {
  executeRun: executeScraperRun,
  enqueueRun: async (runId, options) => {
    const { pushJob } = await import("@peated/server/worker/client");
    await pushJob("RunScraper", { runId }, options);
  },
};

export async function runScraper(
  input: JobPayload,
  services: RunScraperServices = defaultServices,
) {
  const { runId } = InputSchema.parse(input);
  const result = await services.executeRun({ runId });
  if (result.status !== "deferred" && result.status !== "not_ready") return;

  const delay = Math.max(0, result.nextAttemptAt.getTime() - Date.now());
  await services.enqueueRun(runId, {
    delay,
    jobId: `scraper-run-${runId}-${result.nextAttemptAt.getTime()}`,
    removeOnComplete: true,
    removeOnFail: true,
  });
}

export default async function runScraperJob(input: JobPayload) {
  return await runScraper(input);
}
