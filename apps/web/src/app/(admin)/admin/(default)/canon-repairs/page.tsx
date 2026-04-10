"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Form from "@peated/web/components/form";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import TextInput from "@peated/web/components/textInput";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

function formatTastingCount(value: null | number): string {
  return (value ?? 0).toLocaleString();
}

function buildCanonRepairHref(
  pathname: string,
  searchParams: URLSearchParams,
  nextParams: Record<string, null | number | string | undefined>,
): string {
  const queryString = buildQueryString(searchParams, nextParams);
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export default function Page() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("query") ?? "";
  const queryParams = useApiQueryParams({
    defaults: {
      limit: 25,
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: candidateList } = useSuspenseQuery(
    orpc.bottles.canonRepairCandidates.queryOptions({
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
            name: "Canon Repairs",
            href: "/admin/canon-repairs",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Canon Repairs</SimpleHeader>

      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
          High-confidence same-brand bottle variants where the current canonical
          bottle name likely needs to be merged into an existing cleaner target.
          This queue links directly into the existing moderator merge flow with
          the suggested target preselected.
        </div>

        <Form
          action={pathname}
          className="mb-0 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <TextInput
                type="text"
                name="query"
                defaultValue={currentQuery}
                placeholder="Search bottle names"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" color="primary">
                Search
              </Button>
              {currentQuery ? (
                <Button
                  href={buildCanonRepairHref(pathname, searchParams, {
                    query: null,
                    cursor: null,
                  })}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </Form>
      </div>

      <div className="space-y-4">
        {candidateList.results.length === 0 ? (
          <EmptyActivity>
            {currentQuery
              ? "No canon repair candidates matched that search."
              : "No canon repair candidates right now."}
          </EmptyActivity>
        ) : (
          candidateList.results.map((candidate) => (
            <div
              key={candidate.bottle.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-5"
            >
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-200">
                    Same-brand wording variant
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {candidate.bottle.fullName}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {formatTastingCount(candidate.bottle.totalTastings)}{" "}
                      tastings on the current bottle,{" "}
                      {candidate.bottle.numReleases} child releases
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button href={`/bottles/${candidate.bottle.id}`}>
                    Open Current Bottle
                  </Button>
                  <Button href={`/bottles/${candidate.targetBottle.id}`}>
                    Open Suggested Target
                  </Button>
                  <Button
                    color="primary"
                    href={`/bottles/${candidate.bottle.id}/merge?other=${candidate.targetBottle.id}&direction=mergeInto`}
                  >
                    Open Merge
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Current Canon Bottle
                  </div>
                  <div className="text-base font-medium text-white">
                    {candidate.bottle.fullName}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {formatTastingCount(candidate.bottle.totalTastings)}{" "}
                    tastings and {candidate.bottle.numReleases} releases
                    currently live on this row.
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-200">
                    Suggested Merge Target
                  </div>
                  <div className="text-base font-medium text-white">
                    {candidate.targetBottle.fullName}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {formatTastingCount(candidate.targetBottle.totalTastings)}{" "}
                    tastings and {candidate.targetBottle.numReleases} releases
                    on the proposed canonical target.
                  </div>
                </div>
              </div>

              {candidate.variantBottles.length > 0 ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Other Variant Bottles
                  </div>
                  <div className="space-y-1 text-sm text-slate-300">
                    {candidate.variantBottles.map((variant) => (
                      <div key={variant.id}>
                        {variant.fullName} ·{" "}
                        {formatTastingCount(variant.totalTastings)} tastings ·{" "}
                        {variant.numReleases} releases
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}

        <PaginationButtons rel={candidateList.rel} />
      </div>
    </>
  );
}
