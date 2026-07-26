"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import DecisionRow from "./decisionRow";

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
                    Bottle
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
