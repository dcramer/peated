"use client";

import ReviewWorkbenchStats from "@peated/web/components/admin/reviewWorkbenchStats";
import WorkbenchCard from "@peated/web/components/admin/workbenchCard";
import { ADMIN_WORKSTREAMS } from "@peated/web/components/admin/workstreams";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Link from "@peated/web/components/link";
import SimpleHeader from "@peated/web/components/simpleHeader";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";

function getQueueDetail(queueQuery: {
  data:
    | {
        results: Array<{
          price: {
            name: string;
          };
        }>;
      }
    | undefined;
  isError: boolean;
  isLoading: boolean;
}) {
  if (queueQuery.isLoading) {
    return "Checking the current listing review queue.";
  }

  if (queueQuery.isError) {
    return "Could not load the current listing review queue.";
  }

  const topListing = queueQuery.data?.results[0]?.price.name;
  if (!topListing) {
    return "No actionable listings are waiting for review right now.";
  }

  return `Top listing waiting for review: ${topListing}`;
}

function QueueHealthCard({
  isError,
  isLoading,
  queueInfo,
}: {
  isError: boolean;
  isLoading: boolean;
  queueInfo:
    | {
        stats: {
          active: number;
          failed: number;
          wait: number;
        };
      }
    | undefined;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Background Jobs
      </div>
      <h2 className="mt-2 text-lg font-semibold text-white">Queue Health</h2>
      <p className="mt-2 text-sm text-slate-300">
        {isError
          ? "Queue stats are temporarily unavailable."
          : "Keep an eye on worker pressure while you are reviewing listings and repairs."}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          {
            label: "Waiting",
            value: isLoading
              ? "..."
              : isError
                ? "\u2014"
                : (queueInfo?.stats.wait ?? 0),
          },
          {
            label: "Active",
            value: isLoading
              ? "..."
              : isError
                ? "\u2014"
                : (queueInfo?.stats.active ?? 0),
          },
          {
            label: "Failed",
            value: isLoading
              ? "..."
              : isError
                ? "\u2014"
                : (queueInfo?.stats.failed ?? 0),
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-4"
          >
            <div className="text-xl font-semibold text-white">{item.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Admin() {
  const orpc = useORPC();
  const incomingListings = ADMIN_WORKSTREAMS.find(
    (workstream) => workstream.id === "queue",
  )!;
  const audits = ADMIN_WORKSTREAMS.find(
    (workstream) => workstream.id === "audits",
  )!;

  const queueQuery = useQuery(
    orpc.prices.matchQueue.list.queryOptions({
      input: {
        cursor: 1,
        kind: null,
        limit: 1,
        query: "",
        sort: "priority",
        state: "actionable",
      },
    }),
  );
  const queueInfoQuery = useQuery(
    orpc.admin.queueInfo.queryOptions({
      refetchInterval: 5000,
    }),
  );
  const reviewWorkbenchStatsQuery = useQuery(
    orpc.admin.reviewWorkbenchStats.queryOptions({
      refetchInterval: 60_000,
    }),
  );

  const actionableCount = queueQuery.isError
    ? null
    : (queueQuery.data?.stats.actionableCount ?? 0);
  const processingCount = queueQuery.isError
    ? null
    : (queueQuery.data?.stats.processingCount ?? 0);

  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Review Workbench</SimpleHeader>

      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_340px]">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Start Here
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Two focused queues cover moderation.
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Start with Incoming Listings to decide the Bottle assigned to a
              retailer listing. Use Audits for Suggested Changes, including
              Bottle and Entity updates or merges.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Incoming work
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Review new or changed store listings in{" "}
                  <Link
                    href={incomingListings.href}
                    className="font-medium text-white underline"
                  >
                    {incomingListings.pageTitle}
                  </Link>
                  .
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Catalog changes
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Review Suggested Changes and findings in{" "}
                  <Link
                    href={audits.href}
                    className="font-medium text-white underline"
                  >
                    {audits.pageTitle}
                  </Link>
                  .
                </div>
              </div>
            </div>
          </div>

          <QueueHealthCard
            isError={queueInfoQuery.isError}
            isLoading={queueInfoQuery.isLoading}
            queueInfo={queueInfoQuery.data}
          />
        </section>

        <ReviewWorkbenchStats
          isError={reviewWorkbenchStatsQuery.isError}
          isLoading={reviewWorkbenchStatsQuery.isLoading}
          stats={reviewWorkbenchStatsQuery.data}
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <WorkbenchCard
            badges={
              queueQuery.isError
                ? [
                    {
                      label: "Unavailable",
                      tone: "amber",
                    },
                  ]
                : [
                    {
                      label: queueQuery.isLoading
                        ? "Loading"
                        : `${actionableCount} actionable`,
                      tone: queueQuery.isLoading
                        ? "slate"
                        : actionableCount && actionableCount > 0
                          ? "amber"
                          : "emerald",
                    },
                    {
                      label: queueQuery.isLoading
                        ? "Loading"
                        : `${processingCount} processing`,
                      tone: queueQuery.isLoading
                        ? "slate"
                        : processingCount && processingCount > 0
                          ? "sky"
                          : "slate",
                    },
                  ]
            }
            detail={getQueueDetail(queueQuery)}
            href={incomingListings.href}
            hrefLabel="Open Incoming Listings"
            summary={incomingListings.summary}
            title={incomingListings.pageTitle}
            whenToUse={incomingListings.whenToUse}
          />
          <WorkbenchCard
            detail="Review Suggested Changes, strike out unsupported fields, remove incorrect changes, and move directly to the next audit."
            href={audits.href}
            hrefLabel="Open Audits"
            summary={audits.summary}
            title={audits.pageTitle}
            whenToUse={audits.whenToUse}
          />
        </section>
      </div>
    </>
  );
}
