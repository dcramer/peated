import { type z } from "zod";
import { serializer } from ".";
import type { ExternalSite, ExternalSiteRun, User } from "../db/schema";
import {
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
    itemCount: item.itemCount,
    error: item.error,
    startedAt: item.startedAt?.toISOString() ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}
