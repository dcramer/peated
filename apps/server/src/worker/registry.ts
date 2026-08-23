import cuid2 from "@paralleldrive/cuid2";
import { withActorContext } from "@peated/server/lib/actorContext";
import { logError, logInfo } from "@peated/server/lib/log";
import * as Sentry from "@sentry/node";
import { applyJobActorContextToSentry } from "./context";
import { type JobFunction } from "./types";

export type JobQueueName = "default" | "scrapers";

/**
 * Keeps queue failure semantics and telemetry aligned: handler errors escape to
 * BullMQ, while a Sentry flush is attempted after successful and failed runs.
 */
function instrumentedJob<TResult>(
  jobName: string,
  jobFn: JobFunction<TResult>,
  queueName: JobQueueName,
): JobFunction {
  const wrappedJob: JobFunction = async function wrappedJob(
    params,
    context = {},
  ) {
    const jobId = cuid2.createId();

    const { traceContext } = context;

    try {
      return await Sentry.continueTrace(
        {
          sentryTrace: traceContext ? traceContext["sentry-trace"] : undefined,
          baggage: traceContext?.baggage,
        },
        async () => {
          return withActorContext(context.actor, async () => {
            return Sentry.withIsolationScope(async (isolationScope) => {
              applyJobActorContextToSentry(isolationScope, context.actor);

              return Sentry.withScope(async function (scope) {
                scope.setContext("job", {
                  name: jobName,
                  id: jobId,
                });
                scope.setTransactionName(jobName);

                return await Sentry.startSpan(
                  {
                    op: `consume ${queueName}`,
                    name: `bullmq.${jobName.toLowerCase()}`,
                  },
                  async (span) => {
                    span.setAttribute("messaging.operation.type", "process");
                    span.setAttribute("messaging.operation.name", "consume");
                    span.setAttribute("messaging.destination.name", queueName);
                    span.setAttribute("messaging.message.id", jobId);
                    span.setAttribute("messaging.system", "bullmq");

                    logInfo("Running job {jobName} {jobId}", {
                      extra: {
                        jobName,
                        jobId,
                      },
                    });
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
                      throw e;
                    } finally {
                      const duration = new Date().getTime() - start;

                      logInfo("Job {status} {jobName} {jobId}", {
                        extra: {
                          status: success ? "succeeded" : "failed",
                          jobName,
                          jobId,
                          durationMs: duration,
                        },
                      });
                    }
                  },
                );
              });
            });
          });
        },
      );
    } finally {
      try {
        await Sentry.flush(2000);
      } catch (error) {
        logError(error, {
          extra: {
            operation: "sentry.flush",
            jobName,
            jobId,
          },
        });
      }
    }
  };
  return wrappedJob;
}

class Registry {
  private jobs: Record<string, { fn: JobFunction; queueName: JobQueueName }> =
    {};

  add<TResult>(
    name: string,
    fn: JobFunction<TResult>,
    { queueName = "default" }: { queueName?: JobQueueName } = {},
  ) {
    this.jobs[name] = {
      fn: instrumentedJob(name, fn, queueName),
      queueName,
    };
  }

  get(name: string) {
    const rv = this.jobs[name];
    if (rv === undefined) {
      throw new Error(`Unknown job: ${name}`);
    }
    return rv.fn;
  }

  getQueueName(name: string) {
    const rv = this.jobs[name];
    if (rv === undefined) {
      throw new Error(`Unknown job: ${name}`);
    }
    return rv.queueName;
  }
}

export default new Registry();
