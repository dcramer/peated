"use client";

import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import ModerationNav from "./moderationNav";

export default function AutomationPage() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const options = orpc.admin.moderation.automation.queryOptions({
    refetchInterval: 5_000,
  });
  const { data } = useSuspenseQuery(options);
  const retryAll = useMutation(
    orpc.prices.matchQueue.retryAll.mutationOptions(),
  );
  const cancel = useMutation(
    orpc.prices.matchQueue.cancelRetryRun.mutationOptions(),
  );
  const activeRun = useSuspenseQuery(
    orpc.prices.matchQueue.activeRetryRun.queryOptions({
      refetchInterval: 5_000,
    }),
  );
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      queryClient.invalidateQueries({
        queryKey: orpc.prices.matchQueue.activeRetryRun.key(),
      }),
    ]);
  }

  async function startRetry() {
    setError(null);
    try {
      await retryAll.mutateAsync({ query: "", kind: null, mode: "no_web" });
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The retry run could not be started.",
      );
    }
  }

  async function cancelRun() {
    const run = activeRun.data.run;
    if (!run) return;
    setError(null);
    try {
      await cancel.mutateAsync({ run: run.id });
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The retry run could not be canceled.",
      );
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950">
      <ModerationNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Operational work
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              Automation
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              See what is moving, what is waiting, and what needs recovery.
              Human catalog decisions stay in Inbox.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </div>

        <section
          aria-label="Automation summary"
          className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {[
            ["Processing", data.counts.processing, "text-sky-300"],
            ["Waiting", data.counts.waiting, "text-slate-200"],
            ["Failed", data.counts.failed, "text-red-300"],
            ["Cleared today", data.counts.clearedToday, "text-emerald-300"],
          ].map(([label, count, color]) => (
            <div
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              key={label}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className={`mt-2 text-3xl font-semibold ${color}`}>{count}</p>
            </div>
          ))}
        </section>

        {activeRun.data.run ? (
          <section className="mt-6 rounded-xl border border-sky-900/70 bg-sky-950/20 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                  Active listing retry
                </p>
                <h2 className="mt-2 font-semibold text-white">
                  Run #{activeRun.data.run.id}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {activeRun.data.run.processedCount} of{" "}
                  {activeRun.data.run.matchedCount} processed ·{" "}
                  {activeRun.data.run.status}
                </p>
              </div>
              <Button
                className="min-h-11"
                disabled={cancel.isPending}
                loading={cancel.isPending}
                onClick={() => void cancelRun()}
              >
                Cancel run
              </Button>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="bg-highlight h-full"
                style={{
                  width: `${activeRun.data.run.matchedCount ? Math.round((activeRun.data.run.processedCount / activeRun.data.run.matchedCount) * 100) : 0}%`,
                }}
              />
            </div>
          </section>
        ) : null}
        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                Needs attention
              </h2>
              <span className="text-sm text-slate-500">
                {data.needsAttention.length}
              </span>
            </div>
            {data.needsAttention.length ? (
              <div className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950">
                {data.needsAttention.map((item) => (
                  <article className="p-4" key={item.key}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm capitalize text-red-300">
                          {item.status}
                        </p>
                        {item.detail ? (
                          <p className="mt-2 text-sm text-slate-400">
                            {item.detail}
                          </p>
                        ) : null}
                      </div>
                      {item.href ? (
                        <Link
                          className="text-highlight shrink-0 text-sm font-semibold underline"
                          href={item.href}
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-400">
                No operational failures need attention.
              </div>
            )}
          </section>
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                Recent retry runs
              </h2>
              <Button
                className="min-h-11"
                disabled={!!activeRun.data.run || retryAll.isPending}
                loading={retryAll.isPending}
                onClick={() => void startRetry()}
                size="small"
              >
                Retry actionable listings
              </Button>
            </div>
            <div className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950">
              {data.recentRuns.length ? (
                data.recentRuns.map((run) => (
                  <article className="p-4" key={run.key}>
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold text-white">{run.title}</p>
                      <span className="text-xs capitalize text-slate-400">
                        {run.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {run.detail ?? "Progress unavailable"}
                    </p>
                  </article>
                ))
              ) : (
                <p className="p-6 text-center text-sm text-slate-400">
                  No recent retry runs.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
