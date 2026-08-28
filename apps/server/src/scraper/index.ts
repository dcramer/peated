/**
 * Public application boundary for scraper lifecycle operations.
 *
 * Runtime internals and source implementations stay private to this module;
 * API routes and workers only queue, execute, or initialize durable runs.
 */
import type { ExternalSite } from "@peated/server/db/schema";
import type { ExternalSiteKey } from "@peated/server/types";
import { createConfiguredGenerationRun } from "./configured/runs";
import {
  findScraperSourceBySiteKey,
  ScraperTargetDisabledError,
} from "./definitions";
import {
  createScraperLifecycle,
  ExternalSiteRunActiveError,
  type ScraperEnqueue,
} from "./lifecycle";
import { scraperRegistry } from "./registry";
import {
  executeScraperRun as executeRun,
  type ScraperRunExecutionResult,
} from "./runs";
import { syncScraperDefinitions } from "./syncDefinitions";
import type { ScraperRunPayload } from "./types";

const enqueueScraperRun: ScraperEnqueue = async (jobName, args, options) => {
  const { pushJob } = await import("@peated/server/worker/client");
  await pushJob(jobName, args, options);
};

const lifecycle = createScraperLifecycle({
  registry: scraperRegistry,
  enqueue: enqueueScraperRun,
});

export { ExternalSiteRunActiveError, ScraperTargetDisabledError };
export type { ScraperRunExecutionResult };

export function getScraperRegistration(siteKey: ExternalSiteKey) {
  const source = findScraperSourceBySiteKey(scraperRegistry, siteKey);
  return source
    ? {
        targetKeys: [...source.targetKeys],
      }
    : null;
}

export function queueManualExternalSiteRun(input: {
  site: ExternalSite;
  requestedById: number;
}) {
  return lifecycle.queueManualExternalSiteRun(input);
}

export function queueConfiguredScraperPreview(input: {
  site: ExternalSite;
  configVersionId: number;
  requestedById: number;
}) {
  return lifecycle.queueConfiguredScraperPreview(input);
}

export async function queueConfiguredScraperGeneration(input: {
  configuredScraperId: number;
  requestedById: number;
}) {
  const run = await createConfiguredGenerationRun(input);
  await enqueueScraperRun(
    "RunScraper",
    { runId: run.id },
    {
      jobId: `external-site-run-${run.id}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  return run;
}

export function queueScheduledExternalSiteRun(siteId: number) {
  return lifecycle.queueScheduledExternalSiteRun(siteId);
}

export function redispatchStaleExternalSiteRuns(options?: {
  staleBefore?: Date;
  eligibleAt?: Date;
}) {
  return lifecycle.redispatchStaleExternalSiteRuns(options);
}

export function executeScraperRun(
  input: ScraperRunPayload,
): Promise<ScraperRunExecutionResult> {
  return executeRun(input, { registry: scraperRegistry });
}

export function initializeScraperRuntime() {
  return syncScraperDefinitions(scraperRegistry);
}
