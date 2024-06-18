import { context, propagation } from "@opentelemetry/api";
import cuid2 from "@paralleldrive/cuid2";
import * as Sentry from "@sentry/node";
import type { JobFunction } from "faktory-worker";
import faktory, { type Client } from "faktory-worker";
import { logError } from "../lib/log";
import type { ExternalSiteType } from "../types";

let client: Client | null = null;

// process.on("SIGTERM", () => shutdownClient());
// process.on("SIGINT", () => shutdownClient());
// process.on("SIGUSR1", () => shutdownClient());
// process.on("SIGUSR2", () => shutdownClient());
// process.on("uncaughtException", () => shutdownClient());
// process.on("beforeExit", () => shutdownClient());

export async function getClient() {
  if (!client) {
    client = await faktory.connect();
  }
  return client;
}

export async function hasActiveClient() {
  return !!client;
}

export async function shutdownClient() {
  if (!client) return;
  await client.close();
  client = null;
}

// TODO: how can we automate registration here without importing the job code?
export type JobName =
  | "GenerateBottleDetails"
  | "GenerateEntityDetails"
  | "GeocodeEntityLocation"
  | "NotifyDiscordOnTasting"
  | "ScrapeAstorWines"
  | "ScrapeHealthySpirits"
  | "ScrapeSMWS"
  | "ScrapeSMWSA"
  | "ScrapeTotalWine"
  | "ScrapeWoodenCork"
  | "ScrapeWhiskyAdvocate"
  | "CreateMissingBottles";

export async function pushJob(jobName: JobName, args?: any) {
  const client = await getClient();
  await Sentry.startSpan(
    {
      op: "publish",
      name: `faktory.${jobName.toLowerCase()}`,
    },
    async (span) => {
      span.setAttribute("messaging.operation", "publish");
      span.setAttribute("messaging.system", "faktory");

      // pull out traceparent to forward to faktory job
      const activeContext = {};
      propagation.inject(context.active(), activeContext);
      try {
        await client.job(jobName, args, { traceContext: activeContext }).push();
      } catch (e) {
        span.setStatus({
          code: 2, // ERROR
        });
        throw e;
      }
    },
  );
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
