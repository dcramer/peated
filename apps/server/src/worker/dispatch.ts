import type { JobsOptions } from "bullmq";
import type { JobArgs, JobName } from "./types";

type DispatchJob = (
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) => Promise<void>;

type RunJob = (jobName: JobName, args?: JobArgs) => Promise<void>;

export type WorkerDispatch = {
  pushJob: DispatchJob;
  pushUniqueJob: DispatchJob;
  runJob: RunJob;
};

async function loadQueueWorkerDispatch() {
  // Load the full worker only when the app actually sends or runs a job.
  const { queueWorkerDispatch } = await import("./client");
  return queueWorkerDispatch;
}

const queueDispatch: WorkerDispatch = {
  async pushJob(...args) {
    await (await loadQueueWorkerDispatch()).pushJob(...args);
  },
  async pushUniqueJob(...args) {
    await (await loadQueueWorkerDispatch()).pushUniqueJob(...args);
  },
  async runJob(...args) {
    await (await loadQueueWorkerDispatch()).runJob(...args);
  },
};

let workerDispatch = queueDispatch;

export function configureWorkerDispatch(dispatch: WorkerDispatch) {
  workerDispatch = dispatch;
}

/** Use the normal Redis queues again after a test replaced them. */
export function useQueueWorkerDispatch() {
  workerDispatch = queueDispatch;
}

export async function runJob(jobName: JobName, args?: JobArgs) {
  return args === undefined
    ? await workerDispatch.runJob(jobName)
    : await workerDispatch.runJob(jobName, args);
}

export async function pushUniqueJob(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) {
  if (opts !== undefined) {
    return await workerDispatch.pushUniqueJob(jobName, args, opts);
  }
  return args === undefined
    ? await workerDispatch.pushUniqueJob(jobName)
    : await workerDispatch.pushUniqueJob(jobName, args);
}

export async function pushJob(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) {
  if (opts !== undefined) {
    return await workerDispatch.pushJob(jobName, args, opts);
  }
  return args === undefined
    ? await workerDispatch.pushJob(jobName)
    : await workerDispatch.pushJob(jobName, args);
}
