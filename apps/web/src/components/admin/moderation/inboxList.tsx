"use client";

import type { Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import ConfirmationDialog from "@peated/web/components/confirmationDialog.client";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { buildQueryString } from "@peated/web/lib/urls";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];

function ageLabel(value: string): string {
  const minutes = Math.max(
    1,
    Math.floor((Date.now() - Date.parse(value)) / 60_000),
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function inboxTaskHref(
  task: Task,
  searchParams: URLSearchParams,
): string {
  const query = searchParams.toString();
  const href = `/admin/moderation/inbox/${task.kind}/${task.source.kind === "listing" ? task.source.proposalId : task.source.kind === "operation" ? task.source.operationId : task.source.checkId}`;
  return query ? `${href}?${query}` : href;
}

export default function InboxList({
  data,
  selectedKey,
  onIgnoreInconclusive,
  ignoreInconclusivePending = false,
  bulkError,
}: {
  data: Outputs["admin"]["moderation"]["listTasks"];
  selectedKey?: string;
  onIgnoreInconclusive?: () => Promise<void>;
  ignoreInconclusivePending?: boolean;
  bulkError?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const blocked = searchParams.get("blocked") === "true";
  const inconclusive = searchParams.get("inconclusive") === "true";
  const query = searchParams.get("query") ?? "";
  const [confirmingIgnore, setConfirmingIgnore] = useState(false);
  const listPath = pathname.includes("/inbox/")
    ? "/admin/moderation/inbox"
    : pathname;
  const filterHref = (next: Record<string, string | null>) => {
    const value = buildQueryString(searchParams, { ...next, cursor: null });
    return value ? `${listPath}?${value}` : listPath;
  };

  return (
    <section
      aria-label="Moderation Inbox"
      className="min-h-0 border-r border-slate-800 bg-slate-950/60 lg:flex lg:flex-col"
    >
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold text-white">Inbox</h1>
          <span className="text-sm text-slate-400">{data.counts.all} open</span>
        </div>
        <form action={listPath} className="mt-4">
          {category ? (
            <input name="category" type="hidden" value={category} />
          ) : null}
          {blocked ? <input name="blocked" type="hidden" value="true" /> : null}
          {inconclusive ? (
            <input name="inconclusive" type="hidden" value="true" />
          ) : null}
          <label className="sr-only" htmlFor="moderation-search">
            Search Inbox
          </label>
          <input
            className="focus:border-highlight min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            defaultValue={query}
            id="moderation-search"
            name="query"
            placeholder="Search decisions"
            type="search"
          />
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[
            {
              label: `All ${data.counts.all}`,
              active: !category && !blocked && !inconclusive,
              href: filterHref({
                category: null,
                blocked: null,
                inconclusive: null,
              }),
            },
            {
              label: `Listings ${data.counts.listing}`,
              active: category === "listing",
              href: filterHref({ category: "listing", inconclusive: null }),
            },
            {
              label: `Catalog ${data.counts.catalog}`,
              active: category === "catalog",
              href: filterHref({ category: "catalog", inconclusive: null }),
            },
            {
              label: `Inconclusive ${data.counts.inconclusive}`,
              active: inconclusive,
              href: filterHref({
                inconclusive: inconclusive ? null : "true",
                category: null,
                blocked: null,
              }),
            },
            {
              label: `Blocked ${data.counts.blocked}`,
              active: blocked,
              href: filterHref({
                blocked: blocked ? null : "true",
                inconclusive: null,
              }),
            },
          ].map((filter) => (
            <Link
              aria-current={filter.active ? "page" : undefined}
              className={classNames(
                "inline-flex min-h-9 items-center rounded-full border px-3 font-semibold",
                filter.active
                  ? "border-highlight bg-highlight/10 text-highlight"
                  : "border-slate-700 text-slate-300 hover:border-slate-500",
              )}
              href={filter.href}
              key={filter.label}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        {inconclusive && data.counts.inconclusive > 0 ? (
          <div className="mt-4">
            <Button
              color="danger"
              disabled={ignoreInconclusivePending}
              fullWidth
              loading={ignoreInconclusivePending}
              onClick={() => setConfirmingIgnore(true)}
            >
              Ignore all {data.counts.inconclusive} inconclusive
            </Button>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              These listings have no recommended Bottle. Ignoring them removes
              them from the inbox without assigning one.
            </p>
          </div>
        ) : null}
        {bulkError ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {bulkError}
          </p>
        ) : null}
      </div>

      <ConfirmationDialog
        continueLabel={`Ignore ${data.counts.inconclusive} listings`}
        isOpen={confirmingIgnore}
        message="Every actionable inconclusive listing will leave the moderation inbox without a Bottle assignment. Listings with a match, proposed Bottle, correction, error, or active classification will not be changed."
        onCancel={() => setConfirmingIgnore(false)}
        onContinue={() => {
          setConfirmingIgnore(false);
          void onIgnoreInconclusive?.();
        }}
        title="Ignore all inconclusive listings?"
      />

      {data.results.length ? (
        <ol className="divide-y divide-slate-800 overflow-y-auto">
          {data.results.map((task) => {
            const selected = task.key === selectedKey;
            return (
              <li key={task.key}>
                <Link
                  aria-current={selected ? "true" : undefined}
                  className={classNames(
                    "focus-visible:outline-inset focus-visible:outline-highlight block border-l-2 px-4 py-4 focus-visible:outline focus-visible:outline-2",
                    selected
                      ? "border-highlight bg-slate-900"
                      : "border-transparent hover:bg-slate-900/70",
                  )}
                  href={inboxTaskHref(task, searchParams)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {task.category}
                    </span>
                    <span className="text-xs text-slate-500">
                      {ageLabel(task.attentionAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-semibold text-white">
                    {task.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                    {task.question}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-slate-500">
                      {task.sourceLabel}
                    </span>
                    <span
                      className={
                        task.state === "blocked"
                          ? "text-amber-300"
                          : "text-slate-400"
                      }
                    >
                      {task.statusLabel}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="p-8 text-center">
          <p className="font-semibold text-white">Nothing needs a decision</p>
          <p className="mt-2 text-sm text-slate-400">
            Try clearing the filters or check Automation for operational work.
          </p>
        </div>
      )}
    </section>
  );
}
