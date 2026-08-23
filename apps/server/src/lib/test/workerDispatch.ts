import {
  configureWorkerDispatch,
  type WorkerDispatch,
} from "@peated/server/worker/client";
import { vi } from "vitest";

export const pushJob = vi.fn<WorkerDispatch["pushJob"]>();
export const pushUniqueJob = vi.fn<WorkerDispatch["pushUniqueJob"]>();
export const runJob = vi.fn<WorkerDispatch["runJob"]>();

const inMemoryWorkerDispatch = {
  pushJob,
  pushUniqueJob,
  runJob,
} satisfies WorkerDispatch;

export function installInMemoryWorkerDispatch() {
  configureWorkerDispatch(inMemoryWorkerDispatch);
  resetInMemoryWorkerDispatch();
}

export function resetInMemoryWorkerDispatch() {
  pushJob.mockReset();
  pushJob.mockResolvedValue(undefined);
  pushUniqueJob.mockReset();
  pushUniqueJob.mockResolvedValue(undefined);
  runJob.mockReset();
  runJob.mockResolvedValue(undefined);
}
