"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import AdminWorkstreamTabs from "@peated/web/components/admin/workstreamTabs";
import {
  BottleCheckSubject,
  getBottleCheckFindings,
  getBottleCheckOperationCount,
  getBottleCheckState,
  getBottleCheckSummary,
} from "@peated/web/components/bottleChecks/checkSummary";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type BottleCheck = Outputs["audits"]["list"]["results"][number];
type AuditSource = NonNullable<NonNullable<Inputs["audits"]["list"]>["source"]>;

const SOURCE_OPTIONS: Array<{ id: AuditSource | null; label: string }> = [
  { id: null, label: "All" },
  { id: "incoming_listing", label: "Incoming Listings" },
  { id: "new_bottle", label: "New Bottles" },
  { id: "moderator", label: "Moderator" },
  { id: "photo_scan", label: "Photo Scans" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getBottleCheckSourceLabel(
  check: Pick<BottleCheck, "intent" | "origin" | "sourceKind">,
): string {
  if (check.intent === "resolve_reference") {
    if (check.sourceKind === "photo_identification") {
      return "Bottle photo scan";
    }
    return check.sourceKind === "store_price"
      ? "Incoming listing audit"
      : "Bottle reference";
  }

  return check.origin === "post_user_creation"
    ? "Post-create audit"
    : "Moderator audit";
}

function auditHref(checkId: number, source: AuditSource | null) {
  return `/admin/audits/${checkId}${source ? `?source=${source}` : ""}`;
}

export function BottleCheckRow({
  check,
  source = null,
}: {
  check: BottleCheck;
  source?: AuditSource | null;
}) {
  const findings = getBottleCheckFindings(check);
  const unresolvedOperationCount = getBottleCheckOperationCount(check, {
    unresolvedOnly: true,
  });

  const href = auditHref(check.id, source);

  return (
    <article className="grid gap-4 p-4 transition-colors hover:bg-slate-900/70 sm:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.4fr)_auto] sm:items-center">
      <div>
        <BottleCheckSubject check={check} />
        <div className="mt-1 text-xs text-slate-400">
          {getBottleCheckSourceLabel(check)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {formatDate(check.createdAt)}
        </div>
      </div>
      <div className="max-w-xl">
        <div className="text-sm text-slate-200">
          {getBottleCheckSummary(check)}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {unresolvedOperationCount} operation
          {unresolvedOperationCount === 1 ? "" : "s"} · {findings.length}{" "}
          finding{findings.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200">
          {getBottleCheckState(check)}
        </span>
        <Button className="min-h-10 sm:min-h-0" href={href} size="small">
          Review
        </Button>
      </div>
    </article>
  );
}

export function BottleCheckEmptyState({
  clearHref,
  filtered,
}: {
  clearHref: string;
  filtered: boolean;
}) {
  if (!filtered) {
    return <EmptyActivity>No audits need attention.</EmptyActivity>;
  }

  return (
    <EmptyActivity>
      <div className="flex flex-col items-center gap-3">
        <div>No audits match this filter.</div>
        <Button href={clearHref}>Clear filter</Button>
      </div>
    </EmptyActivity>
  );
}

export default function Page() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") as AuditSource | null;
  const queryParams = useApiQueryParams({ numericFields: ["cursor", "limit"] });
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.audits.list.queryOptions({
      input: {
        cursor: queryParams.cursor,
        limit: queryParams.limit,
        ...(source ? { source } : {}),
      },
    }),
  );

  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Audits",
            href: "/admin/audits",
            current: true,
          },
        ]}
      />
      <SimpleHeader>Audits</SimpleHeader>
      <div className="mb-6">
        <AdminWorkstreamTabs />
      </div>
      <label className="mb-5 block sm:hidden">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Audit source
        </span>
        <select
          className="focus:border-peated focus:ring-peated block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1"
          onChange={(event) => {
            const selected = event.currentTarget.value || null;
            const queryString = buildQueryString(searchParams, {
              source: selected,
              cursor: null,
            });
            router.push(queryString ? `${pathname}?${queryString}` : pathname);
          }}
          value={source ?? ""}
        >
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.label} value={option.id ?? ""}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-6 hidden flex-wrap items-center gap-2 sm:flex">
        {SOURCE_OPTIONS.map((option) => {
          const queryString = buildQueryString(searchParams, {
            source: option.id,
            cursor: null,
          });
          return (
            <Button
              key={option.label}
              active={source === option.id}
              href={queryString ? `${pathname}?${queryString}` : pathname}
              size="small"
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      {data.results.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {data.results.length}
              {data.rel.nextCursor ? "+" : ""} audit
              {data.results.length === 1 && !data.rel.nextCursor
                ? ""
                : "s"}{" "}
              ready
            </p>
            <Button
              className="min-h-10 sm:min-h-0"
              color="highlight"
              href={auditHref(data.results[0]!.id, source)}
              size="small"
            >
              Review next audit
            </Button>
          </div>
          <div className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            {data.results.map((check) => (
              <BottleCheckRow check={check} key={check.id} source={source} />
            ))}
          </div>
        </div>
      ) : (
        <BottleCheckEmptyState
          clearHref={pathname}
          filtered={source !== null}
        />
      )}

      <PaginationButtons rel={data.rel} />
    </>
  );
}
