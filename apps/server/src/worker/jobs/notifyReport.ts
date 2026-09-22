import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendReportEmail } from "@peated/server/lib/email";
import {
  describeReportSubject,
  recordNameOf,
} from "@peated/server/lib/reports";
import { getAdminReport } from "@peated/server/orpc/routes/admin/reports/data";
import { REPORT_REASON_LABELS } from "@peated/server/schemas/reports";
import type { JobPayload } from "@peated/server/worker/types";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";

export const NotifyReportJobArgsSchema = z
  .object({
    reportId: z.number().int().positive(),
  })
  .strict();

/** Email every active moderator and administrator about one new report. */
export default async function notifyReport(input: JobPayload) {
  const { reportId } = NotifyReportJobArgsSchema.parse(input);
  await notifyReportWith(reportId, sendReportEmail);
}

export async function notifyReportWith(
  reportId: number,
  send: typeof sendReportEmail,
) {
  const report = await getAdminReport(reportId);
  // A report closed before the job ran needs no attention.
  if (!report || report.status !== "open") return;

  const recipients = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        or(eq(users.mod, true), eq(users.admin, true)),
        eq(users.verified, true),
        isNull(users.deletedAt),
        isNull(users.suspendedAt),
        // The reporter already knows.
        ne(users.id, report.createdBy.id),
      ),
    );

  await send({
    to: recipients.map((row) => row.email),
    report: {
      id: report.id,
      subject: describeReportSubject({
        objectType: report.objectType,
        objectId: report.objectId,
        reportedUsername: report.reportedUser?.username ?? null,
        recordName: recordNameOf(report.objectType, report.contentPreview),
      }),
      reasonLabel: REPORT_REASON_LABELS[report.reason],
      comment: report.comment,
      reporterUsername: report.createdBy.username,
      contentPreview: report.contentPreview,
      contentPath: report.contentUrl,
    },
  });
}
