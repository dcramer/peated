import * as jobs from "@peated/server/worker/client";
import type { JobName } from "@peated/server/worker/types";
import { vi } from "vitest";

export const pushJob: typeof jobs.pushJob = vi.fn(
  async (jobName: JobName, args?: any) => undefined
);

export const pushUniqueJob: typeof jobs.pushUniqueJob = vi.fn(
  async (jobName: JobName, args?: any) => undefined
);

export const runJob = jobs.runJob;

export const runWorker: typeof jobs.runWorker = vi.fn(async () => undefined);

export const getQueue: typeof jobs.getQueue = vi
  .mocked(jobs.getQueue)
  .mockResolvedValue({
    getJobCounts: vi.fn().mockResolvedValue({
      wait: 5,
      active: 10,
      completed: 100,
      failed: 2,
    }),
  } as any);
