import { vi } from "vitest";
import { runScraper, type RunScraperServices } from "./runScraper";

function createServices() {
  return {
    executeRun: vi.fn<RunScraperServices["executeRun"]>(),
    enqueueRun: vi.fn<RunScraperServices["enqueueRun"]>(),
  };
}

test("queues the same run id for its durable next-attempt time", async () => {
  const services = createServices();
  const nextAttemptAt = new Date(Date.now() + 60_000);
  services.executeRun.mockResolvedValue({
    status: "deferred",
    nextAttemptAt,
  });

  await runScraper({ runId: 42 }, services);

  expect(services.enqueueRun).toHaveBeenCalledWith(42, {
    delay: expect.any(Number),
    jobId: `scraper-run-42-${nextAttemptAt.getTime()}`,
    removeOnComplete: true,
    removeOnFail: true,
  });
});

test("does not enqueue terminal or duplicate deliveries", async () => {
  const services = createServices();
  services.executeRun.mockResolvedValue({ status: "duplicate" });

  await runScraper({ runId: 42 }, services);

  expect(services.enqueueRun).not.toHaveBeenCalled();
});

test("rejects queue payload fields other than run id", async () => {
  const services = createServices();
  await expect(
    runScraper({ runId: 42, source: "unsafe" }, services),
  ).rejects.toThrow();
  expect(services.executeRun).not.toHaveBeenCalled();
});
