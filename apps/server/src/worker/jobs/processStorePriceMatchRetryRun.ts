import { processStorePriceMatchRetryRun } from "@peated/server/lib/storePriceMatchRetryRuns";

export default async ({ runId }: { runId: number }) => {
  await processStorePriceMatchRetryRun({ runId });
};
