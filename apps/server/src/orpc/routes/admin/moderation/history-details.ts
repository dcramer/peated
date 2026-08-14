import { db } from "@peated/server/db";
import {
  actors,
  bottleChecks,
  bottleOperations,
  incomingBottleDecisionLogs,
  users,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ModerationHistoryDetailsSchema } from "./schemas";

const InputSchema = z
  .object({ key: z.string().regex(/^(incoming|operation|closure):\d+$/) })
  .strict();

function operationTitle(
  proposal: (typeof bottleOperations.$inferSelect)["proposal"],
): string {
  switch (proposal.type) {
    case "update_bottle":
      return `Update Bottle #${proposal.input.bottleId}`;
    case "merge_bottles":
      return `Merge Bottle #${proposal.input.sourceBottleId} into #${proposal.input.destinationBottleId}`;
    case "update_entity":
      return `Update Entity #${proposal.input.entityId}`;
    case "merge_entities":
      return `Merge Entity #${proposal.input.sourceEntityId} into #${proposal.input.destinationEntityId}`;
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
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/moderation/history/{key}",
    summary: "Get moderation history details",
    description:
      "Read the available durable context for a completed moderation event. Requires administrator privileges.",
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

    if (kind === "operation") {
      const [row] = await db
        .select({ operation: bottleOperations, actor: users.username })
        .from(bottleOperations)
        .leftJoin(users, eq(users.id, bottleOperations.reviewedById))
        .where(eq(bottleOperations.id, id))
        .limit(1);
      if (!row?.operation.reviewedAt) {
        throw errors.NOT_FOUND({ message: "History event not found." });
      }
      const { operation, actor } = row;
      const reviewedAt = operation.reviewedAt!;
      const activity = [
        {
          label: "Suggestion created",
          occurredAt: operation.createdAt.toISOString(),
        },
        {
          label: "Review recorded",
          occurredAt: reviewedAt.toISOString(),
        },
      ];
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
          occurredAt: reviewedAt.toISOString(),
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
