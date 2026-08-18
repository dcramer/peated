import * as Sentry from "@sentry/node";
import { afterEach, vi } from "vitest";
import registry from "./registry";

afterEach(() => {
  vi.restoreAllMocks();
});

function spyOnSentryFlush() {
  Sentry.init({ enabled: false });
  const client = Sentry.getClient();
  if (!client) {
    throw new Error("Sentry client was not initialized");
  }
  return vi.spyOn(client, "flush").mockResolvedValue(true);
}

describe("worker registry", () => {
  test("keeps scraper jobs on their isolated queue", () => {
    const jobName = `RegistryScraperJob-${crypto.randomUUID()}`;
    registry.add(jobName, async () => undefined, { queueName: "scrapers" });

    expect(registry.getQueueName(jobName)).toBe("scrapers");
  });

  test("flushes Sentry after a successful job", async () => {
    const flush = spyOnSentryFlush();
    const jobName = `RegistrySuccessfulJob-${crypto.randomUUID()}`;
    registry.add(jobName, async () => undefined);

    await expect(registry.get(jobName)()).resolves.toBeUndefined();

    expect(flush).toHaveBeenCalledWith(2000);
  });

  test("flushes Sentry and propagates a failed job", async () => {
    const flush = spyOnSentryFlush();
    const jobName = `RegistryFailedJob-${crypto.randomUUID()}`;
    const jobError = new Error("job failed");
    registry.add(jobName, async () => {
      throw jobError;
    });

    await expect(registry.get(jobName)()).rejects.toBe(jobError);

    expect(flush).toHaveBeenCalledWith(2000);
  });

  test("does not fail a successful job when flushing Sentry fails", async () => {
    const flushError = new Error("flush failed");
    const flush = spyOnSentryFlush().mockRejectedValue(flushError);
    const jobName = `RegistrySuccessfulFlushFailure-${crypto.randomUUID()}`;
    registry.add(jobName, async () => undefined);

    await expect(registry.get(jobName)()).resolves.toBeUndefined();

    expect(flush).toHaveBeenCalledWith(2000);
  });

  test("preserves the job error when flushing Sentry also fails", async () => {
    const flushError = new Error("flush failed");
    const flush = spyOnSentryFlush().mockRejectedValue(flushError);
    const jobName = `RegistryFailedFlushFailure-${crypto.randomUUID()}`;
    const jobError = new Error("job failed");
    registry.add(jobName, async () => {
      throw jobError;
    });

    await expect(registry.get(jobName)()).rejects.toBe(jobError);

    expect(flush).toHaveBeenCalledWith(2000);
  });
});
