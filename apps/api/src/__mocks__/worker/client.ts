import * as jobs from "@peated/api/worker/client";
import { type JobName } from "@peated/api/worker/types";
import { vi } from "vitest";

export const pushJob: typeof jobs.pushJob = vi.fn(
  async (jobName: JobName, args?: any) => undefined,
);

export const pushUniqueJob: typeof jobs.pushUniqueJob = vi.fn(
  async (jobName: JobName, args?: any) => undefined,
);

export const runJob = jobs.runJob;

export const runWorker: typeof jobs.runWorker = vi.fn(async () => undefined);
