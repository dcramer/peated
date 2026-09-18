import { expect, test, vi } from "vitest";
import { FAILED_JOB_RETENTION_MS, removeOldFailedJobs } from "./queue";

test("removes failed jobs older than the retention window from every queue", async () => {
  const first = { clean: vi.fn().mockResolvedValue(["job-1", "job-2"]) };
  const second = { clean: vi.fn().mockResolvedValue([]) };

  const removed = await removeOldFailedJobs([first, second]);

  expect(removed).toEqual(["job-1", "job-2"]);
  expect(first.clean).toHaveBeenCalledWith(
    FAILED_JOB_RETENTION_MS,
    10_000,
    "failed",
  );
  expect(second.clean).toHaveBeenCalledWith(
    FAILED_JOB_RETENTION_MS,
    10_000,
    "failed",
  );
  expect(FAILED_JOB_RETENTION_MS).toBe(3 * 24 * 60 * 60 * 1000);
});
