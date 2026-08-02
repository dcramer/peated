import {
  bottleChecks,
  bottleOperations,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { and, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
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

export const QueueListInputSchema = z
  .object({
    query: z.string().default(""),
    kind: QueueKindSchema,
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

export const SUPPLEMENTAL_WORK_STATUSES = [
  "blocked",
  "pending_review",
  "applying",
  "stale",
  "failed",
] as const;

export function getQueueHasSupplementalWorkSql(): SQL<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1
    FROM ${bottleChecks}
    WHERE ${bottleChecks.storePriceMatchProposalId} = ${storePriceMatchProposals.id}
      AND ${bottleChecks.closedAt} IS NULL
      AND (
        jsonb_array_length(COALESCE(${bottleChecks.output}->'findings', '[]'::jsonb)) > 0
        OR EXISTS (
          SELECT 1
          FROM ${bottleOperations}
          WHERE ${bottleOperations.checkId} = ${bottleChecks.id}
            AND ${bottleOperations.status} IN (${sql.join(
              SUPPLEMENTAL_WORK_STATUSES.map((status) => sql`${status}`),
              sql`, `,
            )})
        )
      )
  )`;
}

function getQueueKindFilter(
  kind: QueueKind,
  includeSupplementalWork: boolean,
): SQL {
  const hasSupplementalWork = includeSupplementalWork
    ? getQueueHasSupplementalWorkSql()
    : undefined;

  if (kind === "errored") {
    return eq(storePriceMatchProposals.status, "errored");
  }

  if (kind) {
    return and(
      or(
        eq(storePriceMatchProposals.status, "pending_review"),
        hasSupplementalWork,
      ),
      eq(storePriceMatchProposals.proposalType, kind),
    ) as SQL;
  }

  return or(
    inArray(storePriceMatchProposals.status, ["pending_review", "errored"]),
    hasSupplementalWork,
  ) as SQL;
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

export function getQueueBaseWhere(
  input: {
    query: string;
    kind: QueueKind;
  },
  options: {
    includeSupplementalWork?: boolean;
  } = {},
): SQL {
  return and(
    eq(storePrices.hidden, false),
    getQueueKindFilter(input.kind, options.includeSupplementalWork ?? false),
    input.query ? ilike(storePrices.name, `%${input.query}%`) : undefined,
  ) as SQL;
}

export function getQueueWhere(
  input: {
    query: string;
    kind: QueueKind;
    state: QueueState;
  },
  options: {
    includeSupplementalWork?: boolean;
  } = {},
): SQL {
  return and(
    getQueueBaseWhere(input, options),
    getQueueStateFilter(input.state),
  ) as SQL;
}
