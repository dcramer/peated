"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import ModerationNav from "./moderationNav";

type Event = Outputs["admin"]["moderation"]["listHistory"]["results"][number];

function eventHref(event: Event, searchParams: URLSearchParams) {
  const [kind, id] = event.key.split(":");
  const query = searchParams.toString();
  return `/admin/moderation/history/${kind}/${id}${query ? `?${query}` : ""}`;
}

function HistoryDetails({ eventKey }: { eventKey: string }) {
  const orpc = useORPC();
  const details = useQuery(
    orpc.admin.moderation.historyDetails.queryOptions({
      input: { key: eventKey },
    }),
  );
  if (details.isPending)
    return (
      <div className="animate-pulse p-8 text-slate-400">
        Loading decision history…
      </div>
    );
  if (details.isError || !details.data)
    return (
      <div className="p-8 text-center">
        <p className="font-semibold text-white">
          Historical context is unavailable
        </p>
        <p className="mt-2 text-sm text-slate-400">
          The durable event could not be loaded. No context has been inferred.
        </p>
      </div>
    );
  const { event, activity } = details.data;
  return (
    <article className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Button
        className="mb-5 min-h-11 lg:hidden"
        href="/admin/moderation/history"
      >
        Back to History
      </Button>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {event.category} · {event.kind.replaceAll("_", " ")}
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-white">{event.title}</h1>
      <div className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Outcome
          </p>
          <p className="mt-1 font-semibold capitalize text-white">
            {event.outcome}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Actor
          </p>
          <p className="mt-1 text-slate-200">{event.actor ?? "Unavailable"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Recorded
          </p>
          <p className="mt-1 text-slate-200">
            {new Date(event.occurredAt).toLocaleString()}
          </p>
        </div>
      </div>
      {details.data.rationale ? (
        <section className="mt-5">
          <h2 className="font-semibold text-white">Rationale</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {details.data.rationale}
          </p>
        </section>
      ) : null}
      {details.data.note ? (
        <section className="mt-5">
          <h2 className="font-semibold text-white">Moderator note</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {details.data.note}
          </p>
        </section>
      ) : null}
      <section className="mt-6">
        <h2 className="font-semibold text-white">Activity</h2>
        <ol className="mt-3 border-l border-slate-700 pl-5">
          {activity.map((item) => (
            <li
              className="relative pb-4 text-sm text-slate-300"
              key={`${item.label}:${item.occurredAt}`}
            >
              <span className="bg-highlight absolute -left-[1.42rem] top-1.5 h-2 w-2 rounded-full" />
              {item.label}
              <span className="mt-1 block text-xs text-slate-500">
                {new Date(item.occurredAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        {details.data.sourceUrl ? (
          <Button className="min-h-11" href={details.data.sourceUrl}>
            Open source
          </Button>
        ) : null}
        {details.data.resourceUrl ? (
          <Button className="min-h-11" href={details.data.resourceUrl}>
            Open affected resource
          </Button>
        ) : null}
      </div>
      <details className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <summary className="cursor-pointer font-semibold text-slate-200">
          Recorded details
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-400">
          {JSON.stringify(details.data.details, null, 2)}
        </pre>
      </details>
    </article>
  );
}

export default function HistoryPage({ selectedKey }: { selectedKey?: string }) {
  const orpc = useORPC();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const query = searchParams.get("query");
  const actor = searchParams.get("actor");
  const outcome = searchParams.get("outcome");
  const input: NonNullable<Inputs["admin"]["moderation"]["listHistory"]> = {
    limit: 100,
  };
  if (query) input.query = query;
  if (category === "listing" || category === "catalog") {
    input.category = category;
  }
  if (actor) input.actor = actor;
  if (outcome) input.outcome = outcome;
  const { data } = useSuspenseQuery(
    orpc.admin.moderation.listHistory.queryOptions({ input }),
  );
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
      <ModerationNav />
      <section
        aria-label="Moderation History"
        className={classNames(
          "border-r border-slate-800 bg-slate-950/60",
          selectedKey ? "hidden lg:block" : "block",
        )}
      >
        <div className="border-b border-slate-800 p-4">
          <h1 className="text-xl font-semibold text-white">History</h1>
          <form action="/admin/moderation/history" className="mt-4 space-y-2">
            <input
              className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white"
              defaultValue={searchParams.get("query") ?? ""}
              name="query"
              placeholder="Search outcomes"
              type="search"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-white"
                defaultValue={category ?? ""}
                name="category"
              >
                <option value="">All work</option>
                <option value="listing">Listings</option>
                <option value="catalog">Catalog</option>
              </select>
              <input
                className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-white"
                defaultValue={searchParams.get("actor") ?? ""}
                name="actor"
                placeholder="Actor"
              />
            </div>
            <input
              className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white"
              defaultValue={searchParams.get("outcome") ?? ""}
              name="outcome"
              placeholder="Outcome"
            />
          </form>
        </div>
        {data.results.length ? (
          <ol className="divide-y divide-slate-800">
            {data.results.map((event) => (
              <li key={event.key}>
                <Link
                  className={classNames(
                    "block border-l-2 px-4 py-4 hover:bg-slate-900",
                    selectedKey === event.key
                      ? "border-highlight bg-slate-900"
                      : "border-transparent",
                  )}
                  href={eventHref(event, searchParams)}
                >
                  <div className="flex justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {event.category}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(event.occurredAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-semibold text-white">
                    {event.title}
                  </p>
                  <p className="mt-1 text-sm capitalize text-slate-300">
                    {event.outcome}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {event.actor ?? "Actor unavailable"}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="p-8 text-center text-sm text-slate-400">
            No completed decisions match these filters.
          </p>
        )}
      </section>
      <main className={selectedKey ? "block" : "hidden lg:block"}>
        {selectedKey ? (
          <HistoryDetails eventKey={selectedKey} />
        ) : (
          <div className="flex min-h-[70vh] items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold text-white">
                Choose a completed decision
              </p>
              <p className="mt-2 text-sm text-slate-400">
                History is read-only and comes from the original durable
                records.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
