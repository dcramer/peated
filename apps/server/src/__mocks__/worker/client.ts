import { type JobArgs, type JobName } from "@peated/server/worker/types";
import { vi } from "vitest";

export const pushJob = vi.fn(
  async (_jobName: JobName, _args?: JobArgs) => undefined,
);

export const pushUniqueJob = vi.fn(
  async (_jobName: JobName, _args?: JobArgs) => undefined,
);

export const runJob = vi.fn(
  async (_jobName: JobName, _args?: JobArgs) => undefined,
);

export const runWorker = vi.fn(async () => undefined);

export const getQueue = vi.fn(async () => ({
  getJobCounts: vi.fn().mockResolvedValue({
    wait: 5,
    active: 10,
    completed: 100,
    failed: 2,
  }),
}));

export const getConnection = vi.fn(async () => null);
