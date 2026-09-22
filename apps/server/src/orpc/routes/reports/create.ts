import { db } from "@peated/server/db";
import { reports } from "@peated/server/db/schema";
import {
  loadReportTarget,
  resolveReportObjectId,
} from "@peated/server/lib/reports";
import { procedure } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import {
  createRateLimit,
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { ReportInputSchema, ReportSchema } from "@peated/server/schemas";
import { pushJob } from "@peated/server/worker/dispatch";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};

// Reports are cheap to send and reviewed by people, so cap them per member.
const reportRateLimit = createRateLimit<AuthenticatedContext>({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  keyPrefix: "reports",
});

export function serializeReport(
  report: typeof reports.$inferSelect,
): z.infer<typeof ReportSchema> {
  return {
    id: report.id,
    objectType: report.objectType,
    objectId: report.objectId,
    reason: report.reason,
    comment: report.comment,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
  };
}

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .use(reportRateLimit)
  .route({
    method: "POST",
    path: "/reports",
    summary: "Report content or a member",
    description:
      "Report a tasting, member review, comment, member, bottle, entity, series, or flight to moderators. Repeating a report while the earlier one is still open returns that open report. Limited to 20 reports per hour.",
    operationId: "createReport",
  })
  .input(ReportInputSchema)
  .output(ReportSchema)
  .handler(async ({ input, context, errors }) => {
    const objectId = await resolveReportObjectId(
      db,
      input.objectType,
      input.objectId,
    );
    const target =
      objectId === null
        ? null
        : await loadReportTarget(db, input.objectType, objectId);
    if (objectId === null || !target) {
      throw errors.NOT_FOUND({ message: "Content not found." });
    }
    if (target.reportedUserId === context.user.id) {
      throw errors.BAD_REQUEST({
        message: "You cannot report your own content.",
      });
    }

    // The partial unique index keeps one open report per member and target.
    const [report] = await db
      .insert(reports)
      .values({
        objectType: input.objectType,
        objectId,
        reportedUserId: target.reportedUserId,
        reason: input.reason,
        comment: input.comment || null,
        createdById: context.user.id,
      })
      .onConflictDoNothing({
        target: [reports.createdById, reports.objectType, reports.objectId],
        where: eq(reports.status, "open"),
      })
      .returning();
    if (report) {
      // Moderators hear about each new report by email; repeats stay quiet.
      await pushJob("NotifyReport", { reportId: report.id });
      return serializeReport(report);
    }

    // Already reported and still open: return that report unchanged.
    const [existing] = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.createdById, context.user.id),
          eq(reports.objectType, input.objectType),
          eq(reports.objectId, objectId),
          eq(reports.status, "open"),
        ),
      )
      .limit(1);
    if (!existing) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to save report.",
      });
    }
    return serializeReport(existing);
  });
