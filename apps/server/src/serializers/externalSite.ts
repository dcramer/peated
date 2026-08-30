import { type z } from "zod";
import { serializer } from ".";
import config from "../config";
import type {
  ExternalReviewPublication,
  ExternalSite,
  ExternalSiteRun,
  User,
} from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import {
  type ExternalReviewPublicationSchema,
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
    imageUrl: item.imageUrl
      ? absoluteUrl(config.API_SERVER, item.imageUrl)
      : null,
    lastRunAt:
      item.lastRunId !== null ? (item.lastRunAt?.toISOString() ?? null) : null,
    nextRunAt: item.nextRunAt?.toISOString() ?? null,
    runEvery: item.runEvery,
  };
}

export const ExternalSiteSerializer = serializer({
  name: "externalSite",
  item: (item: ExternalSite): z.infer<typeof ExternalSiteSchema> => {
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

export function serializeExternalReviewPublication(
  externalSiteId: number,
  publication: ExternalReviewPublication | null,
): z.infer<typeof ExternalReviewPublicationSchema> {
  return {
    externalSiteId,
    approved: publication?.approvedAt != null,
    approvedAt: publication?.approvedAt?.toISOString() ?? null,
    updatedAt: publication?.updatedAt.toISOString() ?? null,
  };
}
