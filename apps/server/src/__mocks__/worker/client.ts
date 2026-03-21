import { type JobName } from "@peated/server/worker/types";
import { vi } from "vitest";

export const pushJob = vi.fn(
  async (_jobName: JobName, _args?: any) => undefined,
);

export const pushUniqueJob = vi.fn(
  async (_jobName: JobName, _args?: any) => undefined,
);

export const runJob = vi.fn(
  async (_jobName: JobName, _args?: Record<string, any>) => undefined,
);

export const runWorker = vi.fn(async () => undefined);

export const getQueue = vi.fn().mockResolvedValue({
  getJobCounts: vi.fn().mockResolvedValue({
    wait: 5,
    active: 10,
    completed: 100,
    failed: 2,
  }),
} as any);

export const getConnection = vi.fn(async () => null);
