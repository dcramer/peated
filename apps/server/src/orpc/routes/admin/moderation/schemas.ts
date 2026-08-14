import { z } from "zod";

export const ModerationTaskKindSchema = z.enum([
  "listing",
  "operation",
  "finding",
]);
export const ModerationTaskCategorySchema = z.enum(["listing", "catalog"]);
export const ModerationTaskStateSchema = z.enum(["ready", "blocked"]);

export const ModerationTaskKeySchema = z
  .string()
  .regex(/^(listing|operation|finding):\d+$/);

export const ModerationTaskSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("listing"),
      proposalId: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("operation"),
      checkId: z.number().int().positive(),
      operationId: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("finding"),
      checkId: z.number().int().positive(),
    })
    .strict(),
]);

export const ModerationTaskSummarySchema = z
  .object({
    key: ModerationTaskKeySchema,
    kind: ModerationTaskKindSchema,
    category: ModerationTaskCategorySchema,
    state: ModerationTaskStateSchema,
    title: z.string(),
    sourceLabel: z.string(),
    question: z.string(),
    statusLabel: z.string(),
    attentionAt: z.string().datetime(),
    source: ModerationTaskSourceSchema,
  })
  .strict();

export const ModerationTaskListInputSchema = z
  .object({
    cursor: z.coerce.number().int().positive().max(100).default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    query: z.string().trim().max(200).optional(),
    category: ModerationTaskCategorySchema.optional(),
    blocked: z.coerce.boolean().optional(),
  })
  .strict()
  .default({ cursor: 1, limit: 50 });

export const ModerationTaskListResponseSchema = z
  .object({
    results: z.array(ModerationTaskSummarySchema),
    counts: z
      .object({
        all: z.number().int().min(0),
        listing: z.number().int().min(0),
        catalog: z.number().int().min(0),
        blocked: z.number().int().min(0),
      })
      .strict(),
    rel: z
      .object({
        nextCursor: z.number().int().positive().nullable(),
        prevCursor: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();

export const ModerationTaskLocatorInputSchema = z
  .object({ key: ModerationTaskKeySchema })
  .strict();

export const ModerationTaskLocatorResponseSchema = z
  .object({ task: ModerationTaskSummarySchema })
  .strict();

export const ModerationHistoryKindSchema = z.enum([
  "incoming_decision",
  "operation",
  "audit_closure",
]);

export const ModerationHistorySummarySchema = z
  .object({
    key: z.string().regex(/^(incoming|operation|closure):\d+$/),
    kind: ModerationHistoryKindSchema,
    category: ModerationTaskCategorySchema,
    title: z.string(),
    outcome: z.string(),
    actor: z.string().nullable(),
    occurredAt: z.string().datetime(),
  })
  .strict();

export const ModerationHistoryListInputSchema = z
  .object({
    cursor: z.coerce.number().int().positive().max(100).default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    query: z.string().trim().max(200).optional(),
    category: ModerationTaskCategorySchema.optional(),
    outcome: z.string().trim().max(100).optional(),
    actor: z.string().trim().max(100).optional(),
  })
  .strict()
  .default({ cursor: 1, limit: 50 });

export const ModerationHistoryListResponseSchema = z
  .object({
    results: z.array(ModerationHistorySummarySchema),
    rel: z
      .object({
        nextCursor: z.number().int().positive().nullable(),
        prevCursor: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();

export const ModerationHistoryDetailsSchema = z
  .object({
    event: ModerationHistorySummarySchema,
    sourceUrl: z.string().nullable(),
    resourceUrl: z.string().nullable(),
    rationale: z.string().nullable(),
    note: z.string().nullable(),
    details: z.record(z.string(), z.unknown()),
    activity: z.array(
      z
        .object({ label: z.string(), occurredAt: z.string().datetime() })
        .strict(),
    ),
  })
  .strict();

const AutomationItemSchema = z
  .object({
    key: z.string(),
    kind: z.enum(["listing", "operation", "retry_run"]),
    title: z.string(),
    status: z.string(),
    detail: z.string().nullable(),
    href: z.string().nullable(),
    occurredAt: z.string().datetime(),
  })
  .strict();

export const ModerationAutomationResponseSchema = z
  .object({
    generatedAt: z.string().datetime(),
    counts: z
      .object({
        processing: z.number().int().min(0),
        waiting: z.number().int().min(0),
        failed: z.number().int().min(0),
        clearedToday: z.number().int().min(0),
      })
      .strict(),
    needsAttention: z.array(AutomationItemSchema),
    recentRuns: z.array(AutomationItemSchema),
  })
  .strict();

export type ModerationTaskSummary = z.infer<typeof ModerationTaskSummarySchema>;
export type ModerationHistorySummary = z.infer<
  typeof ModerationHistorySummarySchema
>;
