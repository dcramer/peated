"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { getBottleBottlingPath } from "@peated/web/lib/bottlings";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

type DecisionLogItem =
  Outputs["admin"]["incomingBottleDecisions"]["results"][number];
type SourceKind = DecisionLogItem["sourceKind"];
type ActorType = DecisionLogItem["actor"]["type"];

const SOURCE_OPTIONS: Array<{ id: SourceKind | null; label: string }> = [
  { id: null, label: "All Sources" },
  { id: "store_price", label: "Store Prices" },
  { id: "review", label: "Reviews" },
];

const ACTOR_OPTIONS: Array<{ id: ActorType | null; label: string }> = [
  { id: null, label: "All Actors" },
  { id: "system", label: "System" },
  { id: "user", label: "Users" },
];

function buildDecisionHref(
  pathname: string,
  searchParams: URLSearchParams,
  nextParams: Record<string, string | number | null | undefined>,
): string {
  const queryString = buildQueryString(searchParams, nextParams);
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function formatDecision(value: DecisionLogItem["decision"]): string {
  switch (value) {
    case "match_existing":
      return "Matched Existing";
    case "create_bottle":
      return "Created Bottle";
    case "create_release":
      return "Created Release";
    case "create_bottle_and_release":
      return "Created Bottle + Release";
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatConfidence(value: number | null): string {
  return value === null ? "n/a" : `${value}`;
}

function getSourceLabel(item: DecisionLogItem): string {
  return item.sourceKind === "store_price" ? "Store Price" : "Review";
}

function getActorLabel(item: DecisionLogItem): string {
  return item.actor.displayName;
}

function getDecisionTone(item: DecisionLogItem): string {
  if (item.actor.type === "system") {
    return "border-sky-800 bg-sky-950/50 text-sky-200";
  }

  return "border-emerald-800 bg-emerald-950/50 text-emerald-200";
}

function DecisionRow({ item }: { item: DecisionLogItem }) {
  return (
    <tr className="border-b border-slate-800 last:border-0">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
        {formatDate(item.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-white">{item.name}</div>
        <div className="mt-1 text-xs text-slate-400">
          {item.externalSite.name} · {getSourceLabel(item)} #{item.sourceId}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${getDecisionTone(item)}`}
        >
          {formatDecision(item.decision)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {getActorLabel(item)}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm">
          <Link href={`/bottles/${item.bottle.id}`} className="text-highlight">
            {item.bottle.fullName}
          </Link>
        </div>
        {item.release ? (
          <div className="mt-1 text-xs">
            <Link
              href={getBottleBottlingPath(item.bottle.id, item.release.id)}
              className="text-slate-300 underline"
            >
              {item.release.fullName}
            </Link>
          </div>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
        {formatConfidence(item.confidence)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {item.url ? (
          <Link href={item.url} className="underline">
            Source
          </Link>
        ) : (
          "n/a"
        )}
      </td>
    </tr>
  );
}

export default function Page() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSourceKind =
    (searchParams.get("sourceKind") as SourceKind | null) ?? null;
  const currentActor = (searchParams.get("actor") as ActorType | null) ?? null;
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: decisionList } = useSuspenseQuery(
    orpc.admin.incomingBottleDecisions.queryOptions({
      input: queryParams,
    }),
  );

  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Incoming Decisions",
            href: "/admin/incoming-decisions",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Incoming Decisions</SimpleHeader>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {SOURCE_OPTIONS.map((option) => (
            <Button
              key={option.label}
              href={buildDecisionHref(pathname, searchParams, {
                sourceKind: option.id,
                cursor: null,
              })}
              size="small"
              active={currentSourceKind === option.id}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTOR_OPTIONS.map((option) => (
            <Button
              key={option.label}
              href={buildDecisionHref(pathname, searchParams, {
                actor: option.id,
                cursor: null,
              })}
              size="small"
              active={currentActor === option.id}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {decisionList.results.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/70">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Incoming
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Decision
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {decisionList.results.map((item) => (
                  <DecisionRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyActivity>No incoming decisions have been recorded.</EmptyActivity>
      )}

      <PaginationButtons rel={decisionList.rel} />
    </>
  );
}
