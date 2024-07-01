import cuid2 from "@paralleldrive/cuid2";
import { logError } from "@peated/server/lib/log";
import type { ExternalSiteType } from "@peated/server/types";
import * as Sentry from "@sentry/node";
import type { JobFunction } from "faktory-worker";
import faktory from "faktory-worker";
import { type JobName } from "./types";

export async function runJob(jobName: JobName, args?: any) {
  return await faktory.registry[jobName](args);
}

type TraceContext = {
  "sentry-trace"?: string;
  baggage?: any;
};

export async function registerJob(jobName: JobName, jobFn: JobFunction) {
  faktory.register(jobName, instrumentedJob(jobName, jobFn));
}

// instrument a job with Sentry
function instrumentedJob<T>(jobName: string, jobFn: JobFunction) {
  return async (...args: unknown[]) => {
    const jobId = cuid2.createId();

    const activeContext: TraceContext =
      args.length > 1
        ? (args[1] as { traceContext: TraceContext }).traceContext
        : {};

    return Sentry.continueTrace(
      {
        sentryTrace: activeContext["sentry-trace"],
        baggage: activeContext.baggage,
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
              op: "process",
              name: `faktory.${jobName.toLowerCase()}`,
            },
            async (span) => {
              span.setAttribute("messaging.operation", "process");
              span.setAttribute("messaging.system", "faktory");

              console.log(`Running job [${jobName} - ${jobId}]`);
              const start = new Date().getTime();
              let success = false;
              try {
                await jobFn(...args);
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
  };
}

export function getJobForSite(site: ExternalSiteType): [JobName, ...unknown[]] {
  switch (site) {
    case "totalwine":
      return ["ScrapeTotalWine"];
    case "astorwines":
      return ["ScrapeAstorWines"];
    case "smws":
      return ["ScrapeSMWS"];
    case "smwsa":
      return ["ScrapeSMWSA"];
    case "whiskyadvocate":
      return ["ScrapeWhiskyAdvocate"];
    case "woodencork":
      return ["ScrapeWoodenCork"];
    case "healthyspirits":
      return ["ScrapeHealthySpirits"];
    default:
      throw new Error("Unknown site");
  }
}
