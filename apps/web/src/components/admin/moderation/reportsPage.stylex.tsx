"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { REPORT_REASON_LABELS } from "@peated/server/schemas/reports";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import useApiQueryParams from "../../../hooks/useApiQueryParams";
import { useORPC } from "../../../lib/orpc/context";
import { buildQueryString } from "../../../lib/urls";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, space } from "../../../styles/tokens.stylex";
import { Timestamp } from "../../timestamp";
import { AdminButton } from "../adminButton.stylex";
import {
  AdminActions,
  AdminPage,
  AdminPageHeader,
  AdminStatus,
} from "../adminContent.stylex";
import { AdminTable } from "../adminTable.stylex";
import { AdminEmptyActivity } from "../adminUtility.stylex";

type Report = Outputs["admin"]["reports"]["list"]["results"][number];
type ReportStatus = Report["status"];

const statuses: ReadonlyArray<{ label: string; value: ReportStatus }> = [
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
];

const STATUS_TONES = {
  open: "warning",
  resolved: "success",
  dismissed: "neutral",
} as const satisfies Record<ReportStatus, string>;

/**
 * Where a moderator works on a report: the Inbox task while it is open, and
 * the History entry once it is closed.
 */
export function reportAdminHref(report: Pick<Report, "id" | "status">) {
  return report.status === "open"
    ? `/admin/moderation/inbox/report/${report.id}`
    : `/admin/moderation/history/report/${report.id}`;
}

/** Every member report, filtered by status. Decisions still happen in the Inbox. */
export default function ReportsPage() {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useApiQueryParams({
    allowedValues: { status: ["open", "resolved", "dismissed"] },
    defaults: { status: "open" },
    fields: ["cursor", "limit", "status"],
  });
  const status: ReportStatus =
    params.status === "resolved" || params.status === "dismissed"
      ? params.status
      : "open";
  const { data } = useSuspenseQuery(
    orpc.admin.reports.list.queryOptions({
      input: {
        status,
        cursor: params.cursor ?? 1,
        limit: params.limit ?? 50,
      },
    }),
  );
  const closed = status !== "open";

  return (
    <AdminPage>
      <AdminPageHeader
        title="Reports"
        description="What members have reported: content, catalog records, and other members. Open reports are decided in the Inbox. Closed reports keep their outcome in History."
      />
      <AdminActions>
        {statuses.map((item) => (
          <AdminButton
            aria-current={status === item.value ? "page" : undefined}
            href={`${pathname}?${buildQueryString(searchParams, {
              cursor: undefined,
              status: item.value,
            })}`}
            key={item.value}
            size="sm"
            variant={status === item.value ? "default" : "tonal"}
          >
            {item.label}
          </AdminButton>
        ))}
      </AdminActions>
      <AdminTable
        columns={[
          {
            fill: true,
            name: "report",
            value: (report) => <ReportSummary report={report} />,
          },
          {
            name: "reportedBy",
            title: "Reported by",
            value: (report) => `@${report.createdBy.username}`,
          },
          {
            name: "status",
            value: (report) => (
              <AdminStatus tone={STATUS_TONES[report.status]}>
                {statuses.find((item) => item.value === report.status)?.label}
              </AdminStatus>
            ),
          },
          {
            name: "sent",
            value: (report) => (
              <Timestamp date={report.createdAt} format="date" />
            ),
          },
          {
            hidden: !closed,
            name: "closedBy",
            title: "Closed by",
            value: (report) =>
              report.closedBy ? `@${report.closedBy.username}` : "Automatic",
          },
          {
            hidden: !closed,
            name: "closed",
            value: (report) =>
              report.closedAt ? (
                <Timestamp date={report.closedAt} format="date" />
              ) : null,
          },
        ]}
        items={data.results}
        noHeaders={!data.results.length}
        rel={data.rel}
        url={reportAdminHref}
      />
      {!data.results.length ? (
        <AdminEmptyActivity>
          {`No ${statuses.find((item) => item.value === status)?.label.toLowerCase()} reports.`}
        </AdminEmptyActivity>
      ) : null}
    </AdminPage>
  );
}

function ReportSummary({ report }: { report: Report }) {
  const others = report.openReportCount;
  return (
    <div {...stylex.props(styles.summary)}>
      <strong>{report.title}</strong>
      <span {...stylex.props(foundationStyles.metadata, styles.detail)}>
        {REPORT_REASON_LABELS[report.reason]}
        {report.comment ? <> — {report.comment}</> : null}
        {others > 0 ? (
          <>
            {" "}
            · {others} more open {others === 1 ? "report" : "reports"} about
            this
          </>
        ) : null}
      </span>
    </div>
  );
}

const styles = stylex.create({
  summary: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  detail: {
    color: colors.inkMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
