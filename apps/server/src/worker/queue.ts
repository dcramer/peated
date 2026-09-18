import { Queue } from "bullmq";
import { getConnection } from "./redis";

// Background work rule (moderation): a failed job stays visible in Admin for
// three days, then it is removed. Completed jobs are removed at once.
export const FAILED_JOB_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export async function getQueue(
  name = "default",
  connection: Awaited<ReturnType<typeof getConnection>> | null = null,
) {
  return new Queue(name, {
    connection: connection || (await getConnection()),
  });
}

/** Remove failed jobs older than the retention window from the given queues. */
export async function removeOldFailedJobs(queues: Pick<Queue, "clean">[]) {
  const removed: string[] = [];
  for (const queue of queues) {
    // BullMQ compares against each job's finish time; the first argument is
    // the minimum age in milliseconds.
    removed.push(
      ...(await queue.clean(FAILED_JOB_RETENTION_MS, 10_000, "failed")),
    );
  }
  return removed;
}
