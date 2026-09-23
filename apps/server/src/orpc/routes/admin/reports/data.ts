import { db } from "@peated/server/db";
import type { ReportStatus } from "@peated/server/db/schema";
import { reports, users, type Report } from "@peated/server/db/schema";
import {
  countOpenReportsByTarget,
  describeReportSubject,
  loadReportTargets,
  recordNameOf,
  reportTargetKey,
} from "@peated/server/lib/reports";
import type { AdminReport } from "@peated/server/schemas";
import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const reporter = alias(users, "reporter");
const reportedUser = alias(users, "reported_user");
const closer = alias(users, "closer");

type AdminReportRow = {
  report: Report;
  createdBy: { id: number; username: string; suspendedAt: Date | null };
  reportedUser: {
    id: number;
    username: string;
    suspendedAt: Date | null;
  } | null;
  closedBy: { id: number; username: string } | null;
};

function selectReports() {
  return db
    .select({
      report: reports,
      createdBy: {
        id: reporter.id,
        username: reporter.username,
        suspendedAt: reporter.suspendedAt,
      },
      reportedUser: {
        id: reportedUser.id,
        username: reportedUser.username,
        suspendedAt: reportedUser.suspendedAt,
      },
      closedBy: {
        id: closer.id,
        username: closer.username,
      },
    })
    .from(reports)
    .innerJoin(reporter, eq(reporter.id, reports.createdById))
    .leftJoin(reportedUser, eq(reportedUser.id, reports.reportedUserId))
    .leftJoin(closer, eq(closer.id, reports.closedById));
}

async function toAdminReports(rows: AdminReportRow[]): Promise<AdminReport[]> {
  const keys = rows.map(({ report }) => report);
  const [targets, openCounts] = await Promise.all([
    loadReportTargets(db, keys),
    countOpenReportsByTarget(db, keys),
  ]);
  return rows.map(({ report, createdBy, reportedUser, closedBy }) => {
    const key = reportTargetKey(report);
    const target = targets.get(key);
    // An open report counts itself; a closed one does not.
    const otherOpen =
      (openCounts.get(key) ?? 0) - (report.status === "open" ? 1 : 0);
    return {
      id: report.id,
      title: describeReportSubject({
        objectType: report.objectType,
        objectId: report.objectId,
        reportedUsername: reportedUser?.username ?? null,
        recordName: recordNameOf(
          report.objectType,
          target?.contentPreview ?? null,
        ),
      }),
      objectType: report.objectType,
      objectId: report.objectId,
      reason: report.reason,
      comment: report.comment,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      createdBy: {
        id: createdBy.id,
        username: createdBy.username,
        suspended: createdBy.suspendedAt !== null,
      },
      reportedUser: reportedUser
        ? {
            id: reportedUser.id,
            username: reportedUser.username,
            suspended: reportedUser.suspendedAt !== null,
          }
        : null,
      contentUrl: target?.contentPath ?? null,
      contentPreview: target?.contentPreview ?? null,
      openReportCount: Math.max(otherOpen, 0),
      closedAt: report.closedAt?.toISOString() ?? null,
      closedBy: closedBy?.id ? closedBy : null,
      closeNote: report.closeNote,
    };
  });
}

export async function listAdminReports(input: {
  status: ReportStatus;
  cursor: number;
  limit: number;
}) {
  const offset = (input.cursor - 1) * input.limit;
  const rows = await selectReports()
    .where(eq(reports.status, input.status))
    .orderBy(
      input.status === "open" ? asc(reports.createdAt) : desc(reports.closedAt),
      asc(reports.id),
    )
    .limit(input.limit + 1)
    .offset(offset);
  const page = rows.slice(0, input.limit);
  return {
    results: await toAdminReports(page),
    rel: {
      nextCursor: rows.length > input.limit ? input.cursor + 1 : null,
      prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
    },
  };
}

export async function getAdminReport(id: number): Promise<AdminReport | null> {
  const rows = await selectReports().where(eq(reports.id, id)).limit(1);
  const [item] = await toAdminReports(rows);
  return item ?? null;
}
