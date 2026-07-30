"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  BottleCheckSubject,
  getBottleCheckFindings,
  getBottleCheckState,
  getBottleCheckSummary,
} from "@peated/web/components/bottleChecks/checkSummary";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

type BottleCheck = Outputs["bottleChecks"]["list"]["results"][number];
type AuditOrigin = NonNullable<BottleCheck["origin"]>;

const ORIGIN_OPTIONS: Array<{ id: AuditOrigin | null; label: string }> = [
  { id: null, label: "All" },
  { id: "post_user_creation", label: "New Bottles" },
  { id: "moderator", label: "Moderator Audits" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BottleCheckRow({ check }: { check: BottleCheck }) {
  const findings = getBottleCheckFindings(check);
  const unresolvedOperations = check.operations.filter((operation) =>
    ["blocked", "pending_review", "applying", "stale", "failed"].includes(
      operation.status,
    ),
  );

  return (
    <tr>
      <td className="px-4 py-4 align-top">
        <BottleCheckSubject check={check} />
        <div className="mt-1 text-xs text-slate-500">
          {check.origin === "post_user_creation"
            ? "New Bottle audit"
            : "Moderator audit"}
        </div>
      </td>
      <td className="max-w-xl px-4 py-4 align-top">
        <div className="text-sm text-slate-200">
          {getBottleCheckSummary(check)}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {unresolvedOperations.length} operation
          {unresolvedOperations.length === 1 ? "" : "s"} · {findings.length}{" "}
          finding{findings.length === 1 ? "" : "s"}
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200">
          {getBottleCheckState(check)}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-slate-400">
        {formatDate(check.createdAt)}
      </td>
      <td className="px-4 py-4 text-right align-top">
        <Link
          className="text-highlight text-sm font-semibold hover:underline"
          href={`/bottle-checks/${check.id}`}
        >
          Review
        </Link>
      </td>
    </tr>
  );
}

export default function Page() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const origin = searchParams.get("origin") as AuditOrigin | null;
  const queryParams = useApiQueryParams({ numericFields: ["cursor", "limit"] });
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.bottleChecks.list.queryOptions({
      input: {
        cursor: queryParams.cursor,
        limit: queryParams.limit,
        ...(origin ? { origin } : {}),
      },
    }),
  );

  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Bottle Checks",
            href: "/bottle-checks",
            current: true,
          },
        ]}
      />
      <SimpleHeader>Bottle Checks</SimpleHeader>
      <div className="mb-6 flex flex-wrap gap-2">
        {ORIGIN_OPTIONS.map((option) => {
          const queryString = buildQueryString(searchParams, {
            origin: option.id,
            cursor: null,
          });
          return (
            <Button
              key={option.label}
              active={origin === option.id}
              href={queryString ? `${pathname}?${queryString}` : pathname}
              size="small"
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      {data.results.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/70">
                <tr>
                  {["Bottle", "Audit", "State", "Created", ""].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.results.map((check) => (
                  <BottleCheckRow check={check} key={check.id} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyActivity>No Bottle checks need attention.</EmptyActivity>
      )}

      <PaginationButtons rel={data.rel} />
    </>
  );
}
