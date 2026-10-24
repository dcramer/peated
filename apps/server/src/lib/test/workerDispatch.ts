import {
  configureWorkerDispatch,
  type WorkerDispatch,
} from "@peated/server/worker/dispatch";
import { vi } from "vitest";

export const pushJob = vi.fn<WorkerDispatch["pushJob"]>();
export const runJob = vi.fn<WorkerDispatch["runJob"]>();

const inMemoryWorkerDispatch = {
  pushJob,
  runJob,
} satisfies WorkerDispatch;

export function installInMemoryWorkerDispatch() {
  configureWorkerDispatch(inMemoryWorkerDispatch);
  resetInMemoryWorkerDispatch();
}

export function resetInMemoryWorkerDispatch() {
  pushJob.mockReset();
  pushJob.mockResolvedValue(undefined);
  runJob.mockReset();
  runJob.mockResolvedValue(undefined);
}
