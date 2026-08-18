import { executeScraperRun } from "@peated/server/scraper/runs";
import { z } from "zod";

const InputSchema = z.object({ runId: z.number().int().positive() }).strict();

export default async function runScraper(input: unknown) {
  const { runId } = InputSchema.parse(input);
  const result = await executeScraperRun({ runId });
  if (result.status !== "deferred" && result.status !== "not_ready") return;

  const { pushJob } = await import("@peated/server/worker/client");
  const delay = Math.max(0, result.nextAttemptAt.getTime() - Date.now());
  await pushJob(
    "RunScraper",
    { runId },
    {
      delay,
      jobId: `scraper-run-${runId}-${result.nextAttemptAt.getTime()}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
}
