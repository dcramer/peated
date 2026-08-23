import {
  AuditBottleOriginSchema,
  BottleCheckIntentSchema,
  type AuditBottleOrigin,
  type BottleCheckIntent,
  type BottleClassificationArtifacts,
  type ProposedOperation,
} from "@peated/bottle-classifier/contract";
import type {
  PreparationError,
  ReviewOperation,
} from "@peated/server/lib/bottleOperationReviewSchemas";
import type { PersistedBottleOperationExecutionResult } from "@peated/server/schemas/bottleOperationResults";
import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { bottles } from "./bottles";
import { storePriceMatchAttempts, storePriceMatchProposals } from "./stores";
import { users } from "./users";

type PersistedJsonValue =
  | boolean
  | null
  | number
  | string
  | PersistedJsonObject
  | PersistedJsonValue[];

interface PersistedJsonObject {
  [key: string]: PersistedJsonValue;
}

type BottleOperationStateToken = Exclude<
  ReviewOperation,
  { status: "blocked" }
>["stateToken"];

// SAFETY: A Zod enum always exposes at least one option, as required by pgEnum.
const bottleCheckIntentValues = BottleCheckIntentSchema.options as [
  BottleCheckIntent,
  ...BottleCheckIntent[],
];
// SAFETY: A Zod enum always exposes at least one option, as required by pgEnum.
const bottleCheckOriginValues = AuditBottleOriginSchema.options as [
  AuditBottleOrigin,
  ...AuditBottleOrigin[],
];

export const bottleCheckIntentEnum = pgEnum(
  "bottle_check_intent",
  bottleCheckIntentValues,
);

export const bottleCheckOriginEnum = pgEnum(
  "bottle_check_origin",
  bottleCheckOriginValues,
);

export const bottleCheckCloseReasonEnum = pgEnum("bottle_check_close_reason", [
  "dismissed",
  "resolved_manually",
]);

export const bottleOperationStatusEnum = pgEnum("bottle_operation_status", [
  "blocked",
  "pending_review",
  "rejected",
  "applying",
  "applied",
  "stale",
  "failed",
]);

export const bottleOperationRejectionReasonEnum = pgEnum(
  "bottle_operation_rejection_reason",
  [
    "wrong_target",
    "wrong_change",
    "insufficient_evidence",
    "resolved_manually",
    "other",
  ],
);

export const bottleChecks = pgTable(
  "bottle_check",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    intent: bottleCheckIntentEnum("intent").notNull(),
    origin: bottleCheckOriginEnum("origin"),
    sourceKind: text("source_kind"),
    sourceId: text("source_id"),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
      { onDelete: "set null" },
    ),
    subjectKey: text("subject_key").notNull(),
    backgroundEventKey: text("background_event_key"),
    schemaVersion: integer("schema_version").notNull(),
    inputSnapshot: jsonb("input_snapshot")
      .$type<PersistedJsonObject>()
      .notNull(),
    output: jsonb("output").$type<PersistedJsonObject>(),
    artifacts: jsonb("artifacts").$type<
      BottleClassificationArtifacts | PersistedJsonObject
    >(),
    model: text("model"),
    modelMetadata: jsonb("model_metadata").$type<PersistedJsonObject>(),
    error: text("error"),
    storePriceMatchProposalId: bigint("store_price_match_proposal_id", {
      mode: "number",
    }).references(() => storePriceMatchProposals.id, { onDelete: "set null" }),
    storePriceMatchAttemptId: bigint("store_price_match_attempt_id", {
      mode: "number",
    }).references(() => storePriceMatchAttempts.id, { onDelete: "set null" }),
    closedById: bigint("closed_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    closeReason: bottleCheckCloseReasonEnum("close_reason"),
    closeNote: text("close_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    closedAt: timestamp("closed_at"),
  },
  (table) => [
    index("bottle_check_subject_created_idx").on(
      table.subjectKey,
      table.createdAt,
    ),
    index("bottle_check_bottle_idx").on(table.bottleId),
    index("bottle_check_source_idx").on(table.sourceKind, table.sourceId),
    uniqueIndex("bottle_check_background_event_unq").on(
      table.backgroundEventKey,
    ),
    index("bottle_check_store_price_proposal_idx").on(
      table.storePriceMatchProposalId,
    ),
    index("bottle_check_store_price_attempt_idx").on(
      table.storePriceMatchAttemptId,
    ),
    index("bottle_check_closed_idx").on(table.closedAt),
  ],
);

export const bottleOperations = pgTable(
  "bottle_operation",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    checkId: bigint("check_id", { mode: "number" })
      .references(() => bottleChecks.id, { onDelete: "cascade" })
      .notNull(),
    proposal: jsonb("proposal").$type<ProposedOperation>().notNull(),
    excludedFields: jsonb("excluded_fields")
      .$type<string[]>()
      .default([])
      .notNull(),
    stateToken: jsonb("state_token").$type<
      BottleOperationStateToken | PersistedJsonObject
    >(),
    preparationError: jsonb("preparation_error").$type<
      PersistedJsonObject | PreparationError
    >(),
    status: bottleOperationStatusEnum("status")
      .default("pending_review")
      .notNull(),
    reviewedById: bigint("reviewed_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: bottleOperationRejectionReasonEnum("rejection_reason"),
    reviewerNote: text("reviewer_note"),
    result: jsonb("result").$type<
      PersistedBottleOperationExecutionResult | PersistedJsonObject
    >(),
    error: text("error"),
    executionStartedAt: timestamp("execution_started_at"),
    executionCompletedAt: timestamp("execution_completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bottle_operation_check_idx").on(table.checkId),
    index("bottle_operation_status_idx").on(table.status),
    index("bottle_operation_reviewer_idx").on(table.reviewedById),
  ],
);

export const bottleChecksRelations = relations(
  bottleChecks,
  ({ many, one }) => ({
    bottle: one(bottles, {
      fields: [bottleChecks.bottleId],
      references: [bottles.id],
    }),
    storePriceMatchProposal: one(storePriceMatchProposals, {
      fields: [bottleChecks.storePriceMatchProposalId],
      references: [storePriceMatchProposals.id],
    }),
    storePriceMatchAttempt: one(storePriceMatchAttempts, {
      fields: [bottleChecks.storePriceMatchAttemptId],
      references: [storePriceMatchAttempts.id],
    }),
    closedBy: one(users, {
      fields: [bottleChecks.closedById],
      references: [users.id],
    }),
    operations: many(bottleOperations),
  }),
);

export const bottleOperationsRelations = relations(
  bottleOperations,
  ({ one }) => ({
    check: one(bottleChecks, {
      fields: [bottleOperations.checkId],
      references: [bottleChecks.id],
    }),
    reviewedBy: one(users, {
      fields: [bottleOperations.reviewedById],
      references: [users.id],
    }),
  }),
);

export type BottleCheck = typeof bottleChecks.$inferSelect;
export type NewBottleCheck = typeof bottleChecks.$inferInsert;
export type BottleOperation = typeof bottleOperations.$inferSelect;
export type NewBottleOperation = typeof bottleOperations.$inferInsert;
