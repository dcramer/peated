import { executeScraperRun } from "@peated/server/scraper";
import { pushJob } from "@peated/server/worker/client";
import { beforeEach, vi } from "vitest";
import runScraper from "./runScraper";

vi.mock("@peated/server/scraper", () => ({
  executeScraperRun: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(executeScraperRun).mockReset();
  vi.mocked(pushJob).mockReset();
});

test("queues the same run id for its durable next-attempt time", async () => {
  const nextAttemptAt = new Date(Date.now() + 60_000);
  vi.mocked(executeScraperRun).mockResolvedValue({
    status: "deferred",
    nextAttemptAt,
  });

  await runScraper({ runId: 42 });

  expect(pushJob).toHaveBeenCalledWith(
    "RunScraper",
    { runId: 42 },
    {
      delay: expect.any(Number),
      jobId: `scraper-run-42-${nextAttemptAt.getTime()}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
});

test("does not enqueue terminal or duplicate deliveries", async () => {
  vi.mocked(executeScraperRun).mockResolvedValue({ status: "duplicate" });

  await runScraper({ runId: 42 });

  expect(pushJob).not.toHaveBeenCalled();
});

test("rejects queue payload fields other than run id", async () => {
  await expect(runScraper({ runId: 42, source: "unsafe" })).rejects.toThrow();
  expect(executeScraperRun).not.toHaveBeenCalled();
});
