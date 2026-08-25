import {
  externalSites,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { and, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

export const QueueKindSchema = z
  .enum(["create_new", "match_existing", "correction", "errored"])
  .nullable()
  .default(null);

export const QueueStateSchema = z
  .enum(["actionable", "processing"])
  .default("actionable");

export const QueueSortSchema = z
  .enum(["priority", "created", "-created"])
  .default("priority");

export const QueueSiteSchema = ExternalSiteTypeEnum.optional();

export const QueueListInputSchema = z
  .object({
    query: z.string().default(""),
    kind: QueueKindSchema,
    site: QueueSiteSchema,
    state: QueueStateSchema,
    sort: QueueSortSchema,
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(50),
  })
  .default({
    query: "",
    kind: null,
    state: "actionable",
    sort: "priority",
    cursor: 1,
    limit: 50,
  });

type QueueKind = z.infer<typeof QueueKindSchema>;
type QueueState = z.infer<typeof QueueStateSchema>;

function getQueueKindFilter(kind: QueueKind): SQL {
  if (kind === "errored") {
    return eq(storePriceMatchProposals.status, "errored");
  }

  if (kind) {
    const filter = and(
      eq(storePriceMatchProposals.status, "pending_review"),
      eq(storePriceMatchProposals.proposalType, kind),
    );
    if (!filter) throw new Error("Queue kind filter is empty");
    return filter;
  }

  return inArray(storePriceMatchProposals.status, [
    "pending_review",
    "errored",
  ]);
}

export function getQueueProcessingFilter(): SQL {
  return sql`${storePriceMatchProposals.processingExpiresAt} IS NOT NULL AND ${storePriceMatchProposals.processingExpiresAt} > NOW()`;
}

export function getQueueActionableFilter(): SQL {
  return sql`(${storePriceMatchProposals.processingExpiresAt} IS NULL OR ${storePriceMatchProposals.processingExpiresAt} <= NOW())`;
}

export function getQueueIsProcessingSql(): SQL<boolean> {
  return sql<boolean>`CASE WHEN ${getQueueProcessingFilter()} THEN true ELSE false END`;
}

export function getQueueStateFilter(state: QueueState): SQL {
  if (state === "processing") {
    return getQueueProcessingFilter();
  }

  return getQueueActionableFilter();
}

export function getQueueBaseWhere(input: {
  query: string;
  kind: QueueKind;
  site?: z.infer<typeof QueueSiteSchema>;
}): SQL {
  const filter = and(
    eq(storePrices.hidden, false),
    getQueueKindFilter(input.kind),
    input.site ? eq(externalSites.type, input.site) : undefined,
    input.query ? ilike(storePrices.name, `%${input.query}%`) : undefined,
  );
  if (!filter) throw new Error("Queue base filter is empty");
  return filter;
}

export function getQueueWhere(input: {
  query: string;
  kind: QueueKind;
  site?: z.infer<typeof QueueSiteSchema>;
  state: QueueState;
}): SQL {
  const filter = and(
    getQueueBaseWhere(input),
    getQueueStateFilter(input.state),
  );
  if (!filter) throw new Error("Queue filter is empty");
  return filter;
}
