import { z } from "zod";
import { CatalogMigrationAuditSchema } from "./catalogMigrationAudit";

export const CATALOG_MIGRATION_RUN_SCHEMA_VERSION = 1 as const;

const CATALOG_MIGRATION_ALIAS_OBSERVATION_TABLES = [
  "bottle_alias",
  "bottle_observation",
] as const;

const CATALOG_MIGRATION_CONSUMER_SURFACES = [
  "tasting",
  "review",
  "collection_bottle",
  "flight_bottle",
  "store_price",
  "incoming_bottle_decision_log",
  "store_price_match_proposal",
  "store_price_match_attempt",
] as const;

const CATALOG_MIGRATION_CONSUMER_PROJECTIONS = [
  "current",
  "suggested",
] as const;

export const CATALOG_MIGRATION_CONSUMER_SLOTS = [
  "tasting",
  "review",
  "collection_bottle",
  "flight_bottle",
  "store_price",
  "incoming_bottle_decision_log",
  "store_price_match_proposal.current",
  "store_price_match_proposal.suggested",
  "store_price_match_attempt.current",
  "store_price_match_attempt.suggested",
] as const;

const CatalogMigrationAliasObservationTableSchema = z.enum(
  CATALOG_MIGRATION_ALIAS_OBSERVATION_TABLES,
);
const CatalogMigrationConsumerSurfaceSchema = z.enum(
  CATALOG_MIGRATION_CONSUMER_SURFACES,
);
const CatalogMigrationConsumerProjectionSchema = z.enum(
  CATALOG_MIGRATION_CONSUMER_PROJECTIONS,
);
const CatalogMigrationConsumerSlotSchema = z.enum(
  CATALOG_MIGRATION_CONSUMER_SLOTS,
);

const CatalogMigrationRunModeSchema = z.enum(["dry_run", "write"]);
const CatalogMigrationRunStatusSchema = z.enum([
  "pending",
  "running",
  "failed",
  "complete",
]);

const CatalogMigrationDatabaseRevisionSchema = z.object({
  id: z.number().int().positive(),
  hash: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

export const CatalogMigrationRunEvidenceSchema = z.object({
  generatedAt: z.string().datetime(),
  gitRevision: z.string().regex(/^[0-9a-f]{40}$/),
  databaseName: z.string().min(1),
  databaseMigration: CatalogMigrationDatabaseRevisionSchema,
});

const CatalogMigrationCheckpointSchema = z.object({
  afterParentId: z.number().int().nonnegative(),
  activeParentId: z.number().int().positive().nullable(),
  nextParentId: z.number().int().positive().nullable(),
});

const CatalogMigrationCountMetricsSchema = z
  .object({
    rows: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    reused: z.number().int().nonnegative(),
  })
  .refine(({ rows, updated, reused }) => rows === updated + reused, {
    message: "rows must equal updated plus reused",
  });

const CatalogMigrationRunMetricsSchema = z.object({
  core: z.object({
    familiesCreated: z.number().int().nonnegative(),
    familiesReused: z.number().int().nonnegative(),
    releasesCreated: z.number().int().nonnegative(),
    releasesReused: z.number().int().nonnegative(),
  }),
  aliases: CatalogMigrationCountMetricsSchema,
  observations: CatalogMigrationCountMetricsSchema,
  consumerSlots: z.object({
    tasting: CatalogMigrationCountMetricsSchema,
    review: CatalogMigrationCountMetricsSchema,
    collection_bottle: CatalogMigrationCountMetricsSchema,
    flight_bottle: CatalogMigrationCountMetricsSchema,
    store_price: CatalogMigrationCountMetricsSchema,
    incoming_bottle_decision_log: CatalogMigrationCountMetricsSchema,
    "store_price_match_proposal.current": CatalogMigrationCountMetricsSchema,
    "store_price_match_proposal.suggested": CatalogMigrationCountMetricsSchema,
    "store_price_match_attempt.current": CatalogMigrationCountMetricsSchema,
    "store_price_match_attempt.suggested": CatalogMigrationCountMetricsSchema,
  }),
});

const CatalogMigrationFailureCodeSchema = z.string().trim().min(1);
const CatalogMigrationFailureRowIdSchema = z
  .union([z.string().trim().min(1), z.number().int().positive()])
  .nullable();

const CatalogMigrationCoreFailureSchema = z.object({
  phase: z.literal("core"),
  parentId: z.number().int().positive(),
  code: CatalogMigrationFailureCodeSchema,
  retryable: z.boolean(),
  releaseId: z.number().int().positive().nullable(),
});

const CatalogMigrationAliasObservationFailureSchema = z
  .object({
    phase: z.literal("alias_observation"),
    parentId: z.number().int().positive(),
    code: CatalogMigrationFailureCodeSchema,
    retryable: z.boolean(),
    releaseId: z.number().int().positive().nullable(),
    table: CatalogMigrationAliasObservationTableSchema.nullable(),
    rowId: CatalogMigrationFailureRowIdSchema,
  })
  .refine(({ table, rowId }) => (table === null) === (rowId === null), {
    message:
      "alias and observation row locators require table and row together",
    path: ["rowId"],
  });

const CatalogMigrationConsumerFailureSchema = z
  .object({
    phase: z.literal("consumers"),
    parentId: z.number().int().positive(),
    code: CatalogMigrationFailureCodeSchema,
    retryable: z.boolean(),
    releaseId: z.number().int().positive().nullable(),
    surface: CatalogMigrationConsumerSurfaceSchema.nullable(),
    rowId: CatalogMigrationFailureRowIdSchema,
    projection: CatalogMigrationConsumerProjectionSchema.nullable(),
  })
  .superRefine(({ surface, rowId, projection }, context) => {
    if (surface === null && (rowId !== null || projection !== null)) {
      context.addIssue({
        code: "custom",
        message: "family failures cannot include row locators",
        path: ["surface"],
      });
    }
    if (surface !== null && rowId === null) {
      context.addIssue({
        code: "custom",
        message: "consumer row failures require a row locator",
        path: ["rowId"],
      });
    }
    if (rowId === null && projection !== null) {
      context.addIssue({
        code: "custom",
        message: "projected failures require a row locator",
        path: ["rowId"],
      });
    }
    const hasProjection =
      surface === "store_price_match_proposal" ||
      surface === "store_price_match_attempt";
    if (surface !== null && hasProjection !== (projection !== null)) {
      context.addIssue({
        code: "custom",
        message:
          "proposal and attempt failures require projections; other failures cannot have them",
        path: ["projection"],
      });
    }
  });

const CatalogMigrationOperationFailureSchema = z.union([
  CatalogMigrationCoreFailureSchema,
  CatalogMigrationAliasObservationFailureSchema,
  CatalogMigrationConsumerFailureSchema,
]);

const CatalogMigrationCheckpointFailureSchema = z.object({
  phase: z.literal("checkpoint"),
  parentId: z.number().int().positive().nullable(),
  code: z.literal("checkpoint_persist_failed"),
  retryable: z.literal(true),
  originalFailure: CatalogMigrationOperationFailureSchema.optional(),
});

const CatalogMigrationRunFailureSchema = z.union([
  CatalogMigrationCheckpointFailureSchema,
  CatalogMigrationOperationFailureSchema,
]);

const CatalogMigrationWriteApprovalSchema = z.object({
  approvedAt: z.string().datetime(),
  approvedBy: z.string().trim().min(1),
  dryRunGeneratedAt: z.string().datetime(),
  gitRevision: z.string().regex(/^[0-9a-f]{40}$/),
  databaseName: z.string().min(1),
  databaseMigration: CatalogMigrationDatabaseRevisionSchema,
});

export const CatalogMigrationWriteApprovalInputSchema = z.object({
  approvedAt: z.string().datetime(),
  approvedBy: z.string().trim().min(1),
});

function revisionsMatch(
  left: z.infer<typeof CatalogMigrationDatabaseRevisionSchema>,
  right: z.infer<typeof CatalogMigrationDatabaseRevisionSchema>,
): boolean {
  return (
    left.id === right.id &&
    left.hash === right.hash &&
    left.createdAt === right.createdAt
  );
}

function metricsAreEmpty(
  metrics: z.infer<typeof CatalogMigrationRunMetricsSchema>,
): boolean {
  return (
    Object.values(metrics.core).every((value) => value === 0) &&
    metrics.aliases.rows === 0 &&
    metrics.observations.rows === 0 &&
    Object.values(metrics.consumerSlots).every(({ rows }) => rows === 0)
  );
}

export const CatalogMigrationRunReportSchema = z
  .object({
    schemaVersion: z.literal(CATALOG_MIGRATION_RUN_SCHEMA_VERSION),
    mode: CatalogMigrationRunModeSchema,
    status: CatalogMigrationRunStatusSchema,
    evidence: CatalogMigrationRunEvidenceSchema,
    checkpoint: CatalogMigrationCheckpointSchema,
    metrics: CatalogMigrationRunMetricsSchema,
    dryRunAudit: CatalogMigrationAuditSchema,
    failure: CatalogMigrationRunFailureSchema.nullable(),
    writeApproval: CatalogMigrationWriteApprovalSchema.nullable(),
  })
  .superRefine((report, context) => {
    const { checkpoint, failure, status } = report;
    if (
      checkpoint.activeParentId !== null &&
      checkpoint.activeParentId <= checkpoint.afterParentId
    ) {
      context.addIssue({
        code: "custom",
        message: "active parent must follow the completed cursor",
        path: ["checkpoint", "activeParentId"],
      });
    }
    if (
      checkpoint.nextParentId !== null &&
      checkpoint.nextParentId <=
        (checkpoint.activeParentId ?? checkpoint.afterParentId)
    ) {
      context.addIssue({
        code: "custom",
        message: "next parent must follow the active or completed cursor",
        path: ["checkpoint", "nextParentId"],
      });
    }
    if (report.dryRunAudit.databaseName !== report.evidence.databaseName) {
      context.addIssue({
        code: "custom",
        message: "audit database must match revision evidence",
        path: ["dryRunAudit", "databaseName"],
      });
    }

    if (report.mode === "dry_run") {
      if (
        status !== "complete" ||
        checkpoint.afterParentId !== 0 ||
        checkpoint.activeParentId !== null ||
        failure !== null ||
        report.writeApproval !== null ||
        !metricsAreEmpty(report.metrics) ||
        report.evidence.generatedAt !== report.dryRunAudit.generatedAt
      ) {
        context.addIssue({
          code: "custom",
          message: "dry-run reports must be complete, read-only evidence",
        });
      }
      return;
    }

    if (report.writeApproval === null) {
      context.addIssue({
        code: "custom",
        message: "write reports require approval evidence",
        path: ["writeApproval"],
      });
    } else {
      const approval = report.writeApproval;
      if (
        approval.dryRunGeneratedAt !== report.dryRunAudit.generatedAt ||
        approval.gitRevision !== report.evidence.gitRevision ||
        approval.databaseName !== report.evidence.databaseName ||
        !revisionsMatch(
          approval.databaseMigration,
          report.evidence.databaseMigration,
        ) ||
        Date.parse(approval.approvedAt) <=
          Date.parse(approval.dryRunGeneratedAt)
      ) {
        context.addIssue({
          code: "custom",
          message: "write approval must match and follow the approved dry run",
          path: ["writeApproval"],
        });
      }
    }

    if (status === "complete") {
      if (
        checkpoint.activeParentId !== null ||
        checkpoint.nextParentId !== null ||
        failure !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "complete write reports cannot retain pending work",
          path: ["status"],
        });
      }
    } else if (status === "pending") {
      if (
        checkpoint.activeParentId !== null ||
        checkpoint.nextParentId === null ||
        failure !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "pending write reports require one next parent",
          path: ["status"],
        });
      }
    } else if (status === "running") {
      if (checkpoint.activeParentId === null || failure !== null) {
        context.addIssue({
          code: "custom",
          message: "running write reports require one active parent",
          path: ["status"],
        });
      }
    } else if (failure === null) {
      context.addIssue({
        code: "custom",
        message: "failed write reports require failure evidence",
        path: ["failure"],
      });
    } else if (failure.phase !== "checkpoint") {
      if (failure.parentId !== checkpoint.activeParentId) {
        context.addIssue({
          code: "custom",
          message: "operation failure parent must match the active parent",
          path: ["failure", "parentId"],
        });
      }
    } else if (failure.originalFailure !== undefined) {
      if (
        failure.parentId !== failure.originalFailure.parentId ||
        failure.parentId !== checkpoint.activeParentId
      ) {
        context.addIssue({
          code: "custom",
          message:
            "checkpoint and original failure parents must match the active parent",
          path: ["failure", "parentId"],
        });
      }
    } else if (failure.parentId === null) {
      if (
        checkpoint.activeParentId !== null ||
        checkpoint.nextParentId !== null
      ) {
        context.addIssue({
          code: "custom",
          message:
            "parentless checkpoint failures require a final no-work checkpoint",
          path: ["failure", "parentId"],
        });
      }
    } else if (
      failure.parentId !== checkpoint.activeParentId &&
      !(
        checkpoint.activeParentId === null &&
        failure.parentId === checkpoint.nextParentId
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "checkpoint failure parent must match the active or pre-core next parent",
        path: ["failure", "parentId"],
      });
    }
  });

export type CatalogMigrationAliasObservationTable = z.infer<
  typeof CatalogMigrationAliasObservationTableSchema
>;
export type CatalogMigrationConsumerSurface = z.infer<
  typeof CatalogMigrationConsumerSurfaceSchema
>;
export type CatalogMigrationConsumerProjection = z.infer<
  typeof CatalogMigrationConsumerProjectionSchema
> | null;
export type CatalogMigrationConsumerSlot = z.infer<
  typeof CatalogMigrationConsumerSlotSchema
>;
export type CatalogMigrationRunEvidence = z.infer<
  typeof CatalogMigrationRunEvidenceSchema
>;
export type CatalogMigrationRunMetrics = z.infer<
  typeof CatalogMigrationRunMetricsSchema
>;
export type CatalogMigrationOperationFailure = z.infer<
  typeof CatalogMigrationOperationFailureSchema
>;
export type CatalogMigrationRunFailure = z.infer<
  typeof CatalogMigrationRunFailureSchema
>;
export type CatalogMigrationWriteApproval = z.infer<
  typeof CatalogMigrationWriteApprovalSchema
>;
export type CatalogMigrationWriteApprovalInput = z.infer<
  typeof CatalogMigrationWriteApprovalInputSchema
>;
export type CatalogMigrationRunReport = z.infer<
  typeof CatalogMigrationRunReportSchema
>;
