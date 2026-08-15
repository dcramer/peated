"use client";

import Button from "@peated/web/components/button";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import InboxList, { inboxTaskHref } from "./inboxList";
import ModerationNav from "./moderationNav";
import TaskDetail from "./taskDetail";

export function nextTaskAfterCompletion<Task extends { key: string }>(
  previousTasks: readonly Task[],
  refreshedTasks: readonly Task[],
  completedKey: string,
): Task | undefined {
  const completedIndex = previousTasks.findIndex(
    ({ key }) => key === completedKey,
  );
  const nextKey =
    completedIndex >= 0 ? previousTasks[completedIndex + 1]?.key : undefined;
  return (
    (nextKey ? refreshedTasks.find(({ key }) => key === nextKey) : undefined) ??
    refreshedTasks[0]
  );
}

export default function InboxPage({
  selected,
}: {
  selected?: { kind: "listing" | "operation" | "finding"; id: number };
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const input = {
    cursor: Number(searchParams.get("cursor") ?? 1),
    limit: 100,
    ...(searchParams.get("query") ? { query: searchParams.get("query")! } : {}),
    ...(searchParams.get("category") === "listing" ||
    searchParams.get("category") === "catalog"
      ? { category: searchParams.get("category") as "listing" | "catalog" }
      : {}),
    ...(searchParams.get("blocked") === "true" ? { blocked: true } : {}),
    ...(searchParams.get("inconclusive") === "true"
      ? { inconclusive: true }
      : {}),
  };
  const listOptions = orpc.admin.moderation.listTasks.queryOptions({ input });
  const { data } = useSuspenseQuery(listOptions);
  const ignoreInconclusive = useMutation(
    orpc.admin.moderation.ignoreInconclusive.mutationOptions(),
  );
  const [announcement, setAnnouncement] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const selectedKey = selected ? `${selected.kind}:${selected.id}` : undefined;

  function openTask(index: number) {
    const task = data.results[index];
    if (!task) {
      router.push("/admin/moderation/inbox");
      return;
    }
    router.push(inboxTaskHref(task, searchParams));
  }

  async function complete(message: string) {
    setAnnouncement(message);
    await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
    const refreshed = await queryClient.fetchQuery(listOptions);
    const next = nextTaskAfterCompletion(
      data.results,
      refreshed.results,
      selectedKey ?? "",
    );
    router.push(
      next ? inboxTaskHref(next, searchParams) : "/admin/moderation/inbox",
    );
  }

  async function ignoreAllInconclusive() {
    setBulkError(null);
    try {
      const { ignored } = await ignoreInconclusive.mutateAsync({});
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.admin.moderation.listTasks.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.prices.matchQueue.key(),
        }),
      ]);
      setAnnouncement(
        `${ignored} inconclusive ${ignored === 1 ? "listing" : "listings"} ignored.`,
      );
      router.push("/admin/moderation/inbox?inconclusive=true");
    } catch (cause) {
      setBulkError(
        cause instanceof Error
          ? cause.message
          : "The inconclusive listings could not be ignored.",
      );
    }
  }

  const selectedIndex = selectedKey
    ? data.results.findIndex(({ key }) => key === selectedKey)
    : -1;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
      <ModerationNav />
      <div className={selected ? "hidden lg:block" : "block"}>
        <InboxList
          bulkError={bulkError}
          data={data}
          ignoreInconclusivePending={ignoreInconclusive.isPending}
          onIgnoreInconclusive={ignoreAllInconclusive}
          selectedKey={selectedKey}
        />
      </div>
      <main className={selected ? "block min-w-0" : "hidden lg:block"}>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        {selectedKey ? (
          <div className="mx-auto max-w-4xl px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:pb-10">
            <div className="mb-4 flex items-center justify-between gap-3 lg:justify-end">
              <Button
                className="min-h-11 lg:hidden"
                href={`/admin/moderation/inbox?${searchParams.toString()}`}
              >
                Back to Inbox
              </Button>
              <Button
                className="min-h-11"
                disabled={selectedIndex < 0}
                onClick={() => openTask(selectedIndex + 1)}
              >
                Skip
              </Button>
            </div>
            <TaskDetail onComplete={complete} taskKey={selectedKey} />
          </div>
        ) : (
          <div className="flex min-h-[70vh] items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold text-white">
                Choose one decision
              </p>
              <p className="mt-2 max-w-sm text-sm text-slate-400">
                The oldest work is first. Each task asks one question and
                advances after you decide.
              </p>
              {data.results[0] ? (
                <Button
                  className="mt-5 min-h-11"
                  color="highlight"
                  href={inboxTaskHref(data.results[0], searchParams)}
                >
                  Start with the oldest
                </Button>
              ) : (
                <Button
                  className="mt-5 min-h-11"
                  href="/admin/moderation/automation"
                >
                  Check Automation
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
