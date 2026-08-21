import { type z } from "zod";
import { serializer } from ".";
import type {
  ExternalReviewSourcePolicy,
  ExternalSite,
  ExternalSiteRun,
  User,
} from "../db/schema";
import {
  type ExternalReviewSourcePolicySchema,
  type ExternalSiteRunSchema,
  type ExternalSiteSchema,
} from "../schemas";

export function serializeExternalSite(
  item: ExternalSite,
): z.infer<typeof ExternalSiteSchema> {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    lastRunAt:
      item.lastRunId !== null ? (item.lastRunAt?.toISOString() ?? null) : null,
    nextRunAt: item.nextRunAt?.toISOString() ?? null,
    runEvery: item.runEvery,
  };
}

export const ExternalSiteSerializer = serializer({
  name: "externalSite",
  item: (
    item: ExternalSite,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof ExternalSiteSchema> => {
    return serializeExternalSite(item);
  },
});

export const ExternalSiteRunSerializer = serializer({
  name: "externalSiteRun",
  item: (item: ExternalSiteRun): z.infer<typeof ExternalSiteRunSchema> =>
    serializeExternalSiteRun(item),
});

export function serializeExternalSiteRun(
  item: ExternalSiteRun,
): z.infer<typeof ExternalSiteRunSchema> {
  return {
    id: item.id,
    status: item.status,
    trigger: item.trigger,
    requestedById: item.requestedById,
    attemptCount: item.attemptCount,
    requestLimit: item.requestLimit,
    sliceRequestCount: item.sliceRequestCount,
    requestCount: item.requestCount,
    retryCount: item.retryCount,
    rateLimitCount: item.rateLimitCount,
    emittedItemCount: item.emittedItemCount,
    itemCount: item.itemCount,
    error: item.error,
    nextAttemptAt: item.nextAttemptAt?.toISOString() ?? null,
    startedAt: item.startedAt?.toISOString() ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}

export function serializeExternalReviewSourcePolicy(
  externalSiteId: number,
  policy: ExternalReviewSourcePolicy | null,
): z.infer<typeof ExternalReviewSourcePolicySchema> {
  return {
    externalSiteId,
    publicationMode: policy?.publicationMode ?? "disabled",
    allowLlmProcessing: policy?.allowLlmProcessing ?? false,
    allowScoreDisplay: policy?.allowScoreDisplay ?? false,
    allowSummaryDisplay: policy?.allowSummaryDisplay ?? false,
    updatedAt: policy?.updatedAt.toISOString() ?? null,
  };
}
