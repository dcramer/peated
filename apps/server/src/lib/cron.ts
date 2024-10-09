import cuid2 from "@paralleldrive/cuid2";
import { logError } from "@peated/server/lib/log";
import * as Sentry from "@sentry/node";
import { AsyncTask, CronJob, ToadScheduler } from "toad-scheduler";

export const scheduler = new ToadScheduler();

export function scheduledJob(
  schedule: string,
  jobName: string,
  cb: () => Promise<void>,
) {
  const task = new AsyncTask(jobName, async () => {
    Sentry.continueTrace({ sentryTrace: undefined, baggage: undefined }, () => {
      return Sentry.withScope(async (scope) => {
        const checkInId = Sentry.captureCheckIn(
          {
            monitorSlug: jobName,
            status: "in_progress",
          },
          {
            schedule: {
              type: "crontab",
              value: schedule,
            },
          },
        );

        const jobId = cuid2.createId();
        scope.setContext("monitor", {
          slug: jobName,
        });

        return await Sentry.startSpan(
          {
            op: `execute`,
            name: `cron.${jobName}`,
          },
          async (span) => {
            console.log(`Running job [${jobName} - ${jobId}]`);
            const start = new Date().getTime();
            let success = false;

            try {
              await cb();
              success = true;
              Sentry.captureCheckIn({
                checkInId,
                monitorSlug: jobName,
                status: "ok",
              });
              span.setStatus({
                code: 1, // OK
              });
            } catch (e) {
              span.setStatus({
                code: 2, // ERROR
              });
              logError(e);
            }

            Sentry.captureCheckIn({
              checkInId,
              monitorSlug: jobName,
              status: success ? "ok" : "error",
            });

            const duration = new Date().getTime() - start;

            console.log(
              `Job ${
                success ? "succeeded" : "failed"
              } [${jobName} - ${jobId}] in ${(duration / 1000).toFixed(3)}s`,
            );
          },
        );
      });
    });
  });

  const job = new CronJob(
    {
      cronExpression: schedule,
    },
    task,
    {
      preventOverrun: true,
    },
  );

  scheduler.addCronJob(job);

  return task;
}
