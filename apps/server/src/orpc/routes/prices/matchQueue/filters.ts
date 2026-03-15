import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { and, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

export const QueueKindSchema = z
  .enum(["create_new", "match_existing", "correction", "errored"])
  .nullable()
  .default(null);

export const QueueStateSchema = z
  .enum(["actionable", "processing"])
  .default("actionable");

export const QueueListInputSchema = z
  .object({
    query: z.string().default(""),
    kind: QueueKindSchema,
    state: QueueStateSchema,
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(50),
  })
  .default({
    query: "",
    kind: null,
    state: "actionable",
    cursor: 1,
    limit: 50,
  });

export const QueueRetryAllInputSchema = z
  .object({
    query: z.string().default(""),
    kind: QueueKindSchema,
  })
  .default({
    query: "",
    kind: null,
  });

type QueueKind = z.infer<typeof QueueKindSchema>;
type QueueState = z.infer<typeof QueueStateSchema>;

function getQueueKindFilter(kind: QueueKind): SQL {
  if (kind === "errored") {
    return eq(storePriceMatchProposals.status, "errored");
  }

  if (kind) {
    return and(
      eq(storePriceMatchProposals.status, "pending_review"),
      eq(storePriceMatchProposals.proposalType, kind),
    ) as SQL;
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
}): SQL {
  return and(
    eq(storePrices.hidden, false),
    getQueueKindFilter(input.kind),
    input.query ? ilike(storePrices.name, `%${input.query}%`) : undefined,
  ) as SQL;
}

export function getQueueWhere(input: {
  query: string;
  kind: QueueKind;
  state: QueueState;
}): SQL {
  return and(getQueueBaseWhere(input), getQueueStateFilter(input.state)) as SQL;
}
