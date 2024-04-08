import { type JobFunction } from "faktory-worker";
import { vi } from "vitest";
import * as jobs from "../jobs/utils";

export const getClient: typeof jobs.getClient = vi.fn();

export const hasActiveClient: typeof jobs.hasActiveClient = vi.fn(
  async () => true,
);
export const shutdownClient: typeof jobs.shutdownClient = vi.fn();

export const pushJob: typeof jobs.pushJob = vi.fn(
  async (jobName: jobs.JobName, args?: any) => undefined,
);
export const registerJob: typeof jobs.registerJob = vi.fn(
  async (jobName: jobs.JobName, jobFn: JobFunction) => undefined,
);

export const getJobForSite = jobs.getJobForSite;
