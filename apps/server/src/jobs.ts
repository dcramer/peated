import { context, propagation } from "@opentelemetry/api";
import * as Sentry from "@sentry/node-experimental";
import type { JobFunction } from "faktory-worker";
import faktory, { type Client } from "faktory-worker";
import type { ExternalSiteType } from "./types";

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
        Sentry.captureException(e);
        span.setStatus({
          code: 2, // ERROR
        });
        throw e;
      }
    },
  );
}

export async function registerJob(jobName: JobName, jobFn: JobFunction) {
  faktory.register(jobName, instrumentedJob(jobName, jobFn));
}

// instrument a job with Sentry
function instrumentedJob<T>(jobName: string, jobFn: JobFunction) {
  return async (...args: unknown[]) => {
    const activeContext = propagation.extract(
      context.active(),
      args.length > 1
        ? (
            args[1] as {
              traceContext: {
                traceId: string;
                baggage: any;
              };
            }
          ).traceContext
        : {},
    );

    context.with(activeContext, async () => {
      return Sentry.withScope(async function (scope) {
        scope.setContext("job", {
          name: jobName,
        });

        return await Sentry.startSpan(
          {
            op: "process",
            name: `faktory.${jobName.toLowerCase()}`,
          },
          async (span) => {
            span.setAttribute("messaging.operation", "process");
            span.setAttribute("messaging.system", "faktory");

            try {
              const rv = await jobFn(...args);
              span.setStatus({
                code: 1, // OK
              });
              return rv;
            } catch (e) {
              Sentry.captureException(e);
              span.setStatus({
                code: 2, // ERROR
              });
              throw e;
            }
          },
        );
      });
    });
  };
}

export function getJobForSite(site: ExternalSiteType): [JobName, ...unknown[]] {
  switch (site) {
    case "totalwines":
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
