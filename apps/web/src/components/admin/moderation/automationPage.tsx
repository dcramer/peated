"use client";

import { useState } from "react";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable } from "@peated/web/components/admin/adminTable.stylex";
import { AdminAlert as Alert } from "@peated/web/components/admin/adminUtility.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

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
    <AdminPage>
      <AdminPageHeader
        title="Background work"
        description="Inspect work that stopped and retry failed price matches. Decisions that need you stay in Inbox."
        metadata={
          <>
            Updated <TimeSince date={data.generatedAt} />
          </>
        }
      />
      {activeRun.data.run ? (
        <AdminSection
          title={`Price retry #${activeRun.data.run.id}`}
          description={`${activeRun.data.run.processedCount} of ${activeRun.data.run.matchedCount} checked`}
          action={
            <Button
              disabled={cancel.isPending}
              loading={cancel.isPending}
              onClick={() => void cancelRun()}
            >
              Cancel run
            </Button>
          }
          tone="accent"
        >
          <AdminStatus tone="accent">{activeRun.data.run.status}</AdminStatus>
        </AdminSection>
      ) : null}
      {error ? <Alert type="error">{error}</Alert> : null}
      <AdminSection
        title="Needs attention"
        description={`${data.needsAttention.length} items`}
      >
        {data.needsAttention.length ? (
          <AdminTable
            items={data.needsAttention}
            primaryKey={(item) => item.key}
            columns={[
              { name: "item", value: (item) => item.title },
              {
                name: "status",
                value: (item) => (
                  <AdminStatus tone="danger">{item.status}</AdminStatus>
                ),
              },
              { name: "detail", value: (item) => item.detail ?? "—" },
              {
                name: "action",
                value: (item) =>
                  item.href ? <TextLink href={item.href}>Open</TextLink> : "—",
              },
            ]}
          />
        ) : (
          "No background work needs attention."
        )}
      </AdminSection>
      <AdminSection
        title="Recent price retries"
        action={
          <AdminActions>
            <Button
              disabled={Boolean(activeRun.data.run) || retryAll.isPending}
              loading={retryAll.isPending}
              onClick={() => void startRetry()}
              size="sm"
            >
              Retry price matches
            </Button>
          </AdminActions>
        }
      >
        {data.recentRuns.length ? (
          <AdminTable
            items={data.recentRuns}
            primaryKey={(run) => run.key}
            columns={[
              { name: "run", value: (run) => run.title },
              {
                name: "status",
                value: (run) => <AdminStatus>{run.status}</AdminStatus>,
              },
              {
                name: "detail",
                value: (run) => run.detail ?? "Progress unavailable",
              },
            ]}
          />
        ) : (
          "No recent price retries."
        )}
      </AdminSection>
    </AdminPage>
  );
}
