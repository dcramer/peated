import type * as jobs from "@peated/server/worker/client";
import { type JobName } from "@peated/server/worker/jobs/types";
import { vi } from "vitest";

export const getClient: typeof jobs.getClient = vi.fn();

export const hasActiveClient: typeof jobs.hasActiveClient = vi.fn(
  async () => true,
);
export const shutdownClient: typeof jobs.shutdownClient = vi.fn();

export const pushJob: typeof jobs.pushJob = vi.fn(
  async (jobName: JobName, args?: any) => undefined,
);

export const runWorker: typeof jobs.runWorker = vi.fn(async () => undefined);
