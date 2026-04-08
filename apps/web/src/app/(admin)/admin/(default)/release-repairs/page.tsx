"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Form from "@peated/web/components/form";
import Link from "@peated/web/components/link";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import TextInput from "@peated/web/components/textInput";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

const MARKER_LABELS: Record<string, string> = {
  structured_edition: "Structured edition",
  name_batch: "Name batch marker",
  structured_release_year: "Structured release year",
  name_release_year: "Name release year",
};

function formatTastingCount(value: null | number): string {
  return (value ?? 0).toLocaleString();
}

function buildReleaseRepairHref(
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
    orpc.bottles.releaseRepairCandidates.queryOptions({
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
            name: "Release Repairs",
            href: "/admin/release-repairs",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Release Repairs</SimpleHeader>

      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
          High-confidence legacy bottles that likely need to be split into a
          reusable parent bottle plus child releases. This view is audit-only
          for now.
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
                placeholder="Search legacy bottle names"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" color="primary">
                Search
              </Button>
              {currentQuery ? (
                <Button
                  href={buildReleaseRepairHref(pathname, searchParams, {
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

      {candidateList.results.length > 0 ? (
        <div className="space-y-4">
          {candidateList.results.map((candidate) => (
            <div
              key={candidate.legacyBottle.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                      {candidate.hasExactParent
                        ? "Exact parent exists"
                        : "Needs parent creation"}
                    </span>
                    {candidate.releaseIdentity.markerSources.map((source) => (
                      <span
                        key={source}
                        className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-400"
                      >
                        {MARKER_LABELS[source] ?? source}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/bottles/${candidate.legacyBottle.id}`}
                    className="block text-lg font-semibold text-white hover:text-slate-300"
                  >
                    {candidate.legacyBottle.fullName}
                  </Link>
                  <div className="mt-1 text-sm text-slate-400">
                    {formatTastingCount(candidate.legacyBottle.totalTastings)}{" "}
                    tastings on legacy bottle
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button href={`/bottles/${candidate.legacyBottle.id}`}>
                    Open Legacy Bottle
                  </Button>
                  {candidate.proposedParent.id ? (
                    <Button href={`/bottles/${candidate.proposedParent.id}`}>
                      Open Parent Bottle
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Proposed Parent
                  </div>
                  {candidate.proposedParent.id ? (
                    <Link
                      href={`/bottles/${candidate.proposedParent.id}`}
                      className="mt-2 block text-sm font-medium text-white hover:text-slate-300"
                    >
                      {candidate.proposedParent.fullName}
                    </Link>
                  ) : (
                    <div className="mt-2 text-sm font-medium text-white">
                      {candidate.proposedParent.fullName}
                    </div>
                  )}
                  <div className="mt-2 text-sm text-slate-400">
                    {candidate.hasExactParent
                      ? `${formatTastingCount(candidate.proposedParent.totalTastings)} tastings on the existing parent bottle.`
                      : "No exact parent bottle exists yet."}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Release Identity
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Edition</dt>
                      <dd className="text-right text-white">
                        {candidate.releaseIdentity.edition ?? "\u2014"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Release Year</dt>
                      <dd className="text-right text-white">
                        {candidate.releaseIdentity.releaseYear ?? "\u2014"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {candidate.siblingLegacyBottles.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Sibling Legacy Bottles
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    {candidate.siblingLegacyBottles.map((sibling) => (
                      <Link
                        key={sibling.id}
                        href={`/bottles/${sibling.id}`}
                        className="text-slate-300 hover:text-white"
                      >
                        {sibling.fullName}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyActivity>
          {currentQuery
            ? "No legacy release repair candidates match the current search."
            : "No legacy release repair candidates found."}
        </EmptyActivity>
      )}

      <PaginationButtons rel={candidateList.rel} />
    </>
  );
}
