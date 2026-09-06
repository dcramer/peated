"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  AdminActions,
  AdminSection,
  AdminStat,
  AdminStatGrid,
  AdminTextLink,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable as Table } from "@peated/web/components/admin/adminTable.stylex";
import TimeSince from "@peated/web/components/timeSince";

type ScraperActivityData = Outputs["admin"]["scraperActivity"];
type ScraperActivityCounts = ScraperActivityData["totals"];
type ScraperActivityProps = { data: ScraperActivityData };

const recordTypeLabels = {
  review: "Reviews",
  price: "Prices",
  catalog: "Products",
  bottle: "Bottles",
  untracked: "Type not tracked",
} as const;

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatRequestErrorDetail(counts: ScraperActivityCounts) {
  if (!counts.requestErrorsComplete) {
    return counts.requestErrors
      ? `At least ${formatCount(counts.requestErrors)} errors · earlier runs did not track errors`
      : "Earlier runs did not track errors";
  }
  return `${formatCount(counts.requestErrors)} errors`;
}

function formatRequestErrorCount(counts: ScraperActivityCounts) {
  if (counts.requestErrorsComplete) return formatCount(counts.requestErrors);
  return counts.requestErrors
    ? `At least ${formatCount(counts.requestErrors)}`
    : "Not tracked";
}

function formatRecordDetail(counts: ScraperActivityCounts) {
  const details = [
    `${formatCount(counts.newRecords)} new`,
    `${formatCount(counts.existingRecords)} seen before`,
  ];
  if (counts.untrackedRecords) {
    details.push(`${formatCount(counts.untrackedRecords)} not tracked`);
  }
  return details.join(" · ");
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

/** Shows the 30-day scraper report on the admin overview. */
export default function ScraperActivity({ data }: ScraperActivityProps) {
  const recordTypes = data.recordTypes.filter(({ records }) => records > 0);

  return (
    <>
      <AdminSection
        title="Scraper activity"
        description="Last 30 days · UTC"
        action={
          <AdminActions>
            <AdminTextLink href="/admin/sites">View scrapers</AdminTextLink>
          </AdminActions>
        }
      >
        <AdminStatGrid>
          <AdminStat
            label="Requests"
            value={formatCount(data.totals.requests)}
            detail={formatRequestErrorDetail(data.totals)}
          />
          <AdminStat
            label="Runs"
            value={formatCount(data.totals.runs)}
            detail={`${formatCount(data.totals.failedRuns)} failed`}
          />
          <AdminStat
            label="Records"
            value={formatCount(data.totals.records)}
            detail={formatRecordDetail(data.totals)}
          />
        </AdminStatGrid>
      </AdminSection>

      {recordTypes.length ? (
        <AdminSection title="Records by type">
          <Table
            items={recordTypes}
            primaryKey={(item) => item.type}
            columns={[
              {
                name: "type",
                value: (item) => recordTypeLabels[item.type],
              },
              {
                name: "records",
                align: "right",
                showOnMobile: true,
                value: (item) => formatCount(item.records),
              },
              {
                name: "new",
                align: "right",
                showOnMobile: true,
                value: (item) => formatCount(item.newRecords),
              },
              {
                name: "seenBefore",
                title: "Seen before",
                align: "right",
                showOnMobile: true,
                value: (item) => formatCount(item.existingRecords),
              },
              {
                name: "notTracked",
                title: "Not tracked",
                align: "right",
                showOnMobile: true,
                value: (item) => formatCount(item.untrackedRecords),
              },
            ]}
          />
        </AdminSection>
      ) : null}

      <AdminSection title="Daily activity">
        <Table
          items={data.days}
          primaryKey={(item) => item.date}
          columns={[
            { name: "day", value: (item) => formatDay(item.date) },
            {
              name: "requests",
              align: "right",
              showOnMobile: true,
              value: (item) => formatCount(item.requests),
            },
            {
              name: "errors",
              align: "right",
              showOnMobile: true,
              value: (item) => formatRequestErrorCount(item),
            },
            {
              name: "runs",
              align: "right",
              showOnMobile: true,
              value: (item) => formatCount(item.runs),
            },
            {
              name: "failed",
              align: "right",
              showOnMobile: true,
              value: (item) => formatCount(item.failedRuns),
            },
            {
              name: "records",
              align: "right",
              showOnMobile: true,
              value: (item) => formatCount(item.records),
            },
            {
              name: "new",
              align: "right",
              showOnMobile: true,
              value: (item) => formatCount(item.newRecords),
            },
            {
              name: "seenBefore",
              title: "Seen before",
              align: "right",
              showOnMobile: true,
              value: (item) => formatCount(item.existingRecords),
            },
            {
              name: "notTracked",
              title: "Not tracked",
              align: "right",
              showOnMobile: true,
              value: (item) => formatCount(item.untrackedRecords),
            },
          ]}
        />
      </AdminSection>

      {data.recentFailures.length ? (
        <AdminSection title="Recent scraper problems">
          <Table
            items={data.recentFailures}
            primaryKey={(item) => String(item.runId)}
            url={(item) => `/admin/sites/${item.site.key}/runs`}
            columns={[
              { name: "scraper", value: (item) => item.site.name },
              {
                name: "error",
                showOnMobile: true,
                value: (item) => item.error,
              },
              {
                name: "when",
                showOnMobile: true,
                value: (item) => <TimeSince date={item.completedAt} />,
              },
            ]}
          />
        </AdminSection>
      ) : null}
    </>
  );
}
