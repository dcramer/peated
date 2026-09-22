import { db } from "@peated/server/db";
import { reports } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  AdminReportCloseInputSchema,
  AdminReportSchema,
} from "@peated/server/schemas";
import { and, eq } from "drizzle-orm";
import { getAdminReport } from "./data";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/admin/reports/{report}/closure",
    summary: "Close a report",
    description:
      "Close a report as resolved or dismissed. Every open report about the same content or member closes with the same outcome. Removing content or suspending a member happens through their own operations; closing only records the outcome. Closing an already closed report changes nothing. Requires a moderator or administrator.",
    operationId: "closeAdminReport",
  })
  .input(AdminReportCloseInputSchema)
  .output(AdminReportSchema)
  .handler(async ({ input, context, errors }) => {
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({
          id: reports.id,
          status: reports.status,
          objectType: reports.objectType,
          objectId: reports.objectId,
        })
        .from(reports)
        .where(eq(reports.id, input.report))
        .limit(1)
        .for("update");
      if (!locked) {
        throw errors.NOT_FOUND({ message: "Report not found." });
      }
      if (locked.status !== "open") return;

      // One decision covers every open report about the same target.
      await tx
        .update(reports)
        .set({
          status: input.status,
          closedById: context.user.id,
          closedAt: new Date(),
          closeNote: input.note || null,
        })
        .where(
          and(
            eq(reports.objectType, locked.objectType),
            eq(reports.objectId, locked.objectId),
            eq(reports.status, "open"),
          ),
        );
    });

    const report = await getAdminReport(input.report);
    if (!report) {
      throw errors.NOT_FOUND({ message: "Report not found." });
    }
    return report;
  });
