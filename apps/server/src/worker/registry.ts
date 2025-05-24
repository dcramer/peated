import cuid2 from "@paralleldrive/cuid2";
import { logError } from "@peated/server/lib/log";
import * as Sentry from "@sentry/node";
import { type JobFunction } from "./types";

// instrument a job with Sentry
function instrumentedJob<T>(jobName: string, jobFn: JobFunction) {
  const wrappedJob: JobFunction = async function wrappedJob(
    params,
    context = {},
  ) {
    const jobId = cuid2.createId();

    const { traceContext } = context;

    const rv = await Sentry.continueTrace(
      {
        sentryTrace: traceContext ? traceContext["sentry-trace"] : undefined,
        baggage: traceContext?.baggage,
      },
      async () => {
        return Sentry.withScope(async function (scope) {
          scope.setContext("job", {
            name: jobName,
            id: jobId,
          });
          scope.setTransactionName(jobName);

          // this is sentry's wrapper
          return await Sentry.startSpan(
            {
              op: "consume default",
              name: `bullmq.${jobName.toLowerCase()}`,
            },
            async (span) => {
              span.setAttribute("messaging.operation.type", "process");
              span.setAttribute("messaging.operation.name", "consume");
              // TODO: THIS IS WRONG - it should set from the worker itself but idk that
              // we have that data
              span.setAttribute("messaging.destination.name", "default");
              span.setAttribute("messaging.message.id", jobId);
              span.setAttribute("messaging.system", "bullmq");

              console.log(`Running job [${jobName} - ${jobId}]`);
              const start = new Date().getTime();
              let success = false;
              try {
                await jobFn(params, context);
                success = true;
                span.setStatus({
                  code: 1, // OK
                });
              } catch (e) {
                logError(e);
                span.setStatus({
                  code: 2, // ERROR
                });
              }

              const duration = new Date().getTime() - start;

              console.log(
                `Job ${
                  success ? "succeeded" : "failed"
                } [${jobName} - ${jobId}] in ${(duration / 1000).toFixed(3)}s`,
              );
            },
          );
        });
      },
    );
    await Sentry.flush(2000);
    return rv;
  };
  return wrappedJob;
}

class Registry {
  private jobs: Record<string, JobFunction> = {};

  add(name: string, fn: JobFunction) {
    this.jobs[name] = instrumentedJob(name, fn);
  }

  get(name: string) {
    const rv = this.jobs[name];
    if (typeof rv === undefined) {
      throw new Error(`Unknown job: ${name}`);
    }
    return rv;
  }
}

export default new Registry();
