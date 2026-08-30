"use client";

import type { Inputs } from "@peated/server/orpc/router";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import { AdminSplitView } from "@peated/web/components/admin/adminContent.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import InboxList, { inboxTaskHref } from "./inboxList";
import {
  ModerationActionBar,
  ModerationDetailContent,
  ModerationDetailFrame,
  ModerationEmpty,
  ScreenReaderAnnouncement,
} from "./moderationDetail.stylex";
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
  const category = searchParams.get("category");
  const query = searchParams.get("query");
  const input: NonNullable<Inputs["admin"]["moderation"]["listTasks"]> = {
    cursor: Number(searchParams.get("cursor") ?? 1),
    limit: 100,
  };
  if (query) input.query = query;
  if (category === "listing" || category === "catalog") {
    input.category = category;
  }
  if (searchParams.get("blocked") === "true") input.blocked = true;
  if (searchParams.get("inconclusive") === "true") input.inconclusive = true;
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
    <>
      <ModerationNav />
      <AdminSplitView
        selected={Boolean(selected)}
        list={
          <InboxList
            bulkError={bulkError}
            data={data}
            ignoreInconclusivePending={ignoreInconclusive.isPending}
            onIgnoreInconclusive={ignoreAllInconclusive}
            selectedKey={selectedKey}
          />
        }
        detail={
          <ModerationDetailFrame>
            <ScreenReaderAnnouncement>{announcement}</ScreenReaderAnnouncement>
            {selectedKey ? (
              <ModerationDetailContent>
                <ModerationActionBar>
                  <Button
                    href={`/admin/moderation/inbox?${searchParams.toString()}`}
                  >
                    Back to Inbox
                  </Button>
                  <Button
                    disabled={selectedIndex < 0}
                    onClick={() => openTask(selectedIndex + 1)}
                  >
                    Skip
                  </Button>
                </ModerationActionBar>
                <TaskDetail onComplete={complete} taskKey={selectedKey} />
              </ModerationDetailContent>
            ) : (
              <ModerationEmpty
                title="Choose one decision"
                action={
                  data.results[0] ? (
                    <Button
                      color="highlight"
                      href={inboxTaskHref(data.results[0], searchParams)}
                    >
                      Start with the oldest
                    </Button>
                  ) : (
                    <Button href="/admin/moderation/automation">
                      Check Automation
                    </Button>
                  )
                }
              >
                The oldest work is first. Each task asks one question and
                advances after you decide.
              </ModerationEmpty>
            )}
          </ModerationDetailFrame>
        }
      />
    </>
  );
}
