/**
 * Public application boundary for scraper lifecycle operations.
 *
 * Runtime internals and source implementations stay private to this module;
 * API routes and workers only queue, execute, or initialize durable runs.
 */
import type { ExternalSite } from "@peated/server/db/schema";
import type { ExternalSiteType } from "@peated/server/types";
import { findScraperSourceBySiteType } from "./definitions";
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
import { ExternalReviewSourcePolicyError } from "./sourcePolicy";
import { syncScraperDefinitions } from "./syncDefinitions";

const enqueueScraperRun: ScraperEnqueue = async (jobName, args, options) => {
  const { pushJob } = await import("@peated/server/worker/client");
  return await pushJob(jobName, args, options);
};

const lifecycle = createScraperLifecycle({
  registry: scraperRegistry,
  enqueue: enqueueScraperRun,
});

export { ExternalReviewSourcePolicyError, ExternalSiteRunActiveError };
export type { ScraperRunExecutionResult };

export function getScraperRegistration(siteType: ExternalSiteType) {
  const source = findScraperSourceBySiteType(scraperRegistry, siteType);
  return source
    ? {
        targetKeys: [...source.targetKeys],
        requiresAuthorization: source.authorize !== undefined,
      }
    : null;
}

export function queueManualExternalSiteRun(input: {
  site: ExternalSite;
  requestedById: number;
}) {
  return lifecycle.queueManualExternalSiteRun(input);
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
  input: unknown,
): Promise<ScraperRunExecutionResult> {
  return executeRun(input, { registry: scraperRegistry });
}

export function initializeScraperRuntime() {
  return syncScraperDefinitions(scraperRegistry);
}
