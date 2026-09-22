import { db } from "@peated/server/db";
import {
  actors,
  bottleChecks,
  bottleOperations,
  incomingBottleDecisionLogs,
  users,
} from "@peated/server/db/schema";
import {
  describeReportSubject,
  recordNameOf,
} from "@peated/server/lib/reports";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { REPORT_REASON_LABELS } from "@peated/server/schemas/reports";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAdminReport } from "../reports/data";
import { ModerationHistoryDetailsSchema } from "./schemas";

const InputSchema = z
  .object({
    key: z.string().regex(/^(incoming|operation|closure|report):\d+$/),
  })
  .strict();

function operationTitle(
  proposal: (typeof bottleOperations.$inferSelect)["proposal"],
): string {
  switch (proposal.type) {
    case "update_bottle":
      return `Update bottle #${proposal.input.bottleId}`;
    case "merge_bottles":
      return `Merge bottle #${proposal.input.sourceBottleId} into #${proposal.input.destinationBottleId}`;
    case "update_entity":
      return `Update brand or producer #${proposal.input.entityId}`;
    case "merge_entities":
      return `Merge brand or producer #${proposal.input.sourceEntityId} into #${proposal.input.destinationEntityId}`;
  }
}

function operationResourceUrl(
  proposal: (typeof bottleOperations.$inferSelect)["proposal"],
): string {
  switch (proposal.type) {
    case "update_bottle":
      return `/bottles/${proposal.input.bottleId}`;
    case "merge_bottles":
      return `/bottles/${proposal.input.destinationBottleId}`;
    case "update_entity":
      return `/entities/${proposal.input.entityId}`;
    case "merge_entities":
      return `/entities/${proposal.input.destinationEntityId}`;
  }
}

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/moderation/history/{key}",
    summary: "Get moderation history details",
    description:
      "Get the recorded evidence, status, and activity for a moderation event. Requires a moderator or administrator.",
    operationId: "getModerationHistoryDetails",
  })
  .input(InputSchema)
  .output(ModerationHistoryDetailsSchema)
  .handler(async ({ input, errors }) => {
    const [kind, rawId] = input.key.split(":");
    const id = Number(rawId);

    if (kind === "incoming") {
      const [row] = await db
        .select({ log: incomingBottleDecisionLogs, actor: actors.displayName })
        .from(incomingBottleDecisionLogs)
        .innerJoin(actors, eq(actors.id, incomingBottleDecisionLogs.actorId))
        .where(eq(incomingBottleDecisionLogs.id, id))
        .limit(1);
      if (!row) throw errors.NOT_FOUND({ message: "History event not found." });
      const { log, actor } = row;
      return {
        event: {
          key: input.key,
          kind: "incoming_decision",
          category: "listing",
          title: log.name,
          outcome: log.decision.replaceAll("_", " "),
          actor,
          occurredAt: log.createdAt.toISOString(),
        },
        sourceUrl: log.url,
        resourceUrl: log.bottleId ? `/bottles/${log.bottleId}` : null,
        rationale: log.rationale,
        note: null,
        details: {
          sourceKind: log.sourceKind,
          sourceId: log.sourceId,
          proposalId: log.proposalId,
          bottleId: log.bottleId,
          confidence: log.confidence,
          model: log.model,
          createdBottle: log.createdBottle,
          createdRelease: log.createdRelease,
          metadata: log.metadata,
        },
        activity: [
          {
            label: "Decision recorded",
            occurredAt: log.createdAt.toISOString(),
          },
        ],
      };
    }

    if (kind === "report") {
      const report = await getAdminReport(id);
      if (!report?.closedAt) {
        throw errors.NOT_FOUND({ message: "History event not found." });
      }
      return {
        event: {
          key: input.key,
          kind: "report",
          category: "community",
          title: describeReportSubject({
            objectType: report.objectType,
            objectId: report.objectId,
            reportedUsername: report.reportedUser?.username ?? null,
            recordName: recordNameOf(report.objectType, report.contentPreview),
          }),
          outcome: report.status,
          actor: report.closedBy?.username ?? null,
          occurredAt: report.closedAt,
        },
        sourceUrl: null,
        resourceUrl: report.contentUrl,
        rationale: report.comment,
        note: report.closeNote,
        details: {
          reportId: report.id,
          objectType: report.objectType,
          objectId: report.objectId,
          reason: REPORT_REASON_LABELS[report.reason],
          reportedBy: report.createdBy.username,
          reportedUser: report.reportedUser?.username ?? null,
        },
        activity: [
          { label: "Report sent", occurredAt: report.createdAt },
          { label: "Report closed", occurredAt: report.closedAt },
        ],
      };
    }

    if (kind === "operation") {
      const [row] = await db
        .select({ operation: bottleOperations, actor: users.username })
        .from(bottleOperations)
        .leftJoin(users, eq(users.id, bottleOperations.reviewedById))
        .where(eq(bottleOperations.id, id))
        .limit(1);
      if (
        !row ||
        (!row.operation.reviewedAt &&
          row.operation.status !== "stale" &&
          row.operation.status !== "failed")
      ) {
        throw errors.NOT_FOUND({ message: "History event not found." });
      }
      const { operation, actor } = row;
      const occurredAt = operation.reviewedAt ?? operation.updatedAt;
      const activity = [
        {
          label: "Suggestion created",
          occurredAt: operation.createdAt.toISOString(),
        },
      ];
      if (operation.reviewedAt) {
        activity.push({
          label: "Review recorded",
          occurredAt: operation.reviewedAt.toISOString(),
        });
      }
      if (operation.executionCompletedAt) {
        activity.push({
          label: "Execution finished",
          occurredAt: operation.executionCompletedAt.toISOString(),
        });
      }
      return {
        event: {
          key: input.key,
          kind: "operation",
          category: "catalog",
          title: operationTitle(operation.proposal),
          outcome: operation.status.replaceAll("_", " "),
          actor,
          occurredAt: occurredAt.toISOString(),
        },
        sourceUrl: null,
        resourceUrl: operationResourceUrl(operation.proposal),
        rationale: null,
        note: operation.reviewerNote,
        details: {
          checkId: operation.checkId,
          proposal: operation.proposal,
          excludedFields: operation.excludedFields,
          rejectionReason: operation.rejectionReason,
          result: operation.result,
          error: operation.error,
        },
        activity,
      };
    }

    const [row] = await db
      .select({ check: bottleChecks, actor: users.username })
      .from(bottleChecks)
      .leftJoin(users, eq(users.id, bottleChecks.closedById))
      .where(eq(bottleChecks.id, id))
      .limit(1);
    if (!row?.check.closedAt) {
      throw errors.NOT_FOUND({ message: "History event not found." });
    }
    const { check, actor } = row;
    const closedAt = check.closedAt!;
    return {
      event: {
        key: input.key,
        kind: "audit_closure",
        category: "catalog",
        title: check.bottleId
          ? `Bottle #${check.bottleId}`
          : `Check #${check.id}`,
        outcome: check.closeReason?.replaceAll("_", " ") ?? "closed",
        actor,
        occurredAt: closedAt.toISOString(),
      },
      sourceUrl: null,
      resourceUrl: check.bottleId ? `/bottles/${check.bottleId}` : null,
      rationale: null,
      note: check.closeNote,
      details: {
        intent: check.intent,
        origin: check.origin,
        sourceKind: check.sourceKind,
        sourceId: check.sourceId,
      },
      activity: [
        { label: "Check created", occurredAt: check.createdAt.toISOString() },
        ...(check.completedAt
          ? [
              {
                label: "Check completed",
                occurredAt: check.completedAt.toISOString(),
              },
            ]
          : []),
        { label: "Check closed", occurredAt: closedAt.toISOString() },
      ],
    };
  });
