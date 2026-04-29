"use client";

import AdminWorkstreamTabs from "@peated/web/components/admin/workstreamTabs";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import Form from "@peated/web/components/form";
import Link from "@peated/web/components/link";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import TextInput from "@peated/web/components/textInput";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { getBottleBottlingPath } from "@peated/web/lib/bottlings";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import BottleSelector from "./bottleSelector";
import QueueItemCard, { type QueueItem } from "./queueItemCard";

type QueueKind = "create_new" | "match_existing" | "correction" | "errored";
type QueueState = "actionable" | "processing";
type QueueSort = "priority" | "created" | "-created";

const DEFAULT_QUEUE_SORT: QueueSort = "priority";

const QUEUE_KIND_OPTIONS: Array<{ id: null | QueueKind; label: string }> = [
  { id: null, label: "All" },
  { id: "create_new", label: "Create" },
  { id: "match_existing", label: "Match" },
  { id: "correction", label: "Correction" },
  { id: "errored", label: "Errored" },
];

const QUEUE_STATE_OPTIONS: Array<{ id: QueueState; label: string }> = [
  { id: "actionable", label: "Actionable" },
  { id: "processing", label: "Processing" },
];

const QUEUE_SORT_OPTIONS: Array<{ id: QueueSort; label: string }> = [
  { id: "priority", label: "Recent Activity" },
  { id: "-created", label: "Newest First" },
  { id: "created", label: "Oldest First" },
];

function getReturnTo(pathname: string, searchParams: URLSearchParams): string {
  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function buildQueueHref(
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
  const currentKind = (searchParams.get("kind") as QueueKind | null) ?? null;
  const currentState =
    (searchParams.get("state") as QueueState | null) ?? "actionable";
  const currentSort =
    (searchParams.get("sort") as QueueSort | null) ?? DEFAULT_QUEUE_SORT;
  const currentQuery = searchParams.get("query") ?? "";
  const returnTo = getReturnTo(pathname, searchParams);
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const listQueryOptions = orpc.prices.matchQueue.list.queryOptions({
    input: queryParams,
  });
  const { data: proposalList } = useSuspenseQuery(listQueryOptions);
  const queryClient = useQueryClient();

  const [selectedProposal, setSelectedProposal] = useState<QueueItem | null>(
    null,
  );
  const [activeRetryRunId, setActiveRetryRunId] = useState<number | null>(null);

  const resolveMutation = useMutation(
    orpc.prices.matchQueue.resolve.mutationOptions(),
  );
  const createBottleMutation = useMutation(
    orpc.prices.matchQueue.createBottle.mutationOptions(),
  );
  const applyBottleRepairMutation = useMutation(
    orpc.prices.matchQueue.applyBottleRepair.mutationOptions(),
  );
  const retryMutation = useMutation(
    orpc.prices.matchQueue.retry.mutationOptions(),
  );
  const retryAllMutation = useMutation(
    orpc.prices.matchQueue.retryAll.mutationOptions(),
  );
  const cancelRetryRunMutation = useMutation(
    orpc.prices.matchQueue.cancelRetryRun.mutationOptions(),
  );
  const activeRetryRunListQuery = useQuery(
    orpc.prices.matchQueue.activeRetryRun.queryOptions({
      refetchInterval: 5000,
    }),
  );
  const activeRetryRunQuery = useQuery(
    orpc.prices.matchQueue.retryRunDetails.queryOptions({
      enabled: activeRetryRunId !== null,
      input: {
        run: activeRetryRunId ?? 0,
      },
      refetchInterval: activeRetryRunId !== null ? 5000 : false,
    }),
  );

  const { flash } = useFlashMessages();
  const isBusy =
    createBottleMutation.isPending ||
    applyBottleRepairMutation.isPending ||
    resolveMutation.isPending ||
    retryMutation.isPending ||
    retryAllMutation.isPending ||
    cancelRetryRunMutation.isPending;
  const canRetryAll = currentState === "actionable";
  const actionableCount = proposalList.stats.actionableCount;
  const activeRetryRun =
    activeRetryRunQuery.data ?? activeRetryRunListQuery.data?.run ?? null;
  const retryRunIsActive =
    activeRetryRun?.status === "pending" ||
    activeRetryRun?.status === "running";

  async function refreshQueueList(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: listQueryOptions.queryKey,
    });
  }

  useEffect(() => {
    if (!activeRetryRun || retryRunIsActive) {
      return;
    }

    void refreshQueueList();
  }, [activeRetryRun?.status, retryRunIsActive]);

  async function handleRetryAll(): Promise<void> {
    if (
      !window.confirm(
        `Start a background retry for ${actionableCount} actionable search result${actionableCount === 1 ? "" : "s"}? Web search will be disabled for this pass.`,
      )
    ) {
      return;
    }

    const result = await retryAllMutation.mutateAsync({
      query: currentQuery,
      kind: currentKind,
      mode: "no_web",
    });
    setActiveRetryRunId(result.id);
    await refreshQueueList();
    flash(
      <div>
        Started retry run <strong className="font-bold">#{result.id}</strong>{" "}
        for <strong className="font-bold">{result.matchedCount}</strong>{" "}
        {result.matchedCount === 1 ? "listing." : "listings."}
      </div>,
    );
  }

  async function handleCancelRetryRun(): Promise<void> {
    if (!activeRetryRun) {
      return;
    }

    const result = await cancelRetryRunMutation.mutateAsync({
      run: activeRetryRun.id,
    });
    setActiveRetryRunId(result.id);
    flash(
      <div>
        Cancel requested for retry run{" "}
        <strong className="font-bold">#{result.id}</strong>.
      </div>,
    );
  }

  async function handleApproveMatch(item: QueueItem): Promise<void> {
    const suggestedBottle = item.suggestedBottle;
    if (!suggestedBottle) {
      return;
    }

    await resolveMutation.mutateAsync({
      proposal: item.id,
      action: "match",
      bottle: suggestedBottle.id,
      release: item.suggestedRelease?.id ?? null,
    });
    await refreshQueueList();
    flash(
      <div>
        Approved match for{" "}
        <strong className="font-bold">{item.price.name}</strong>
      </div>,
    );
  }

  async function handleRetry(item: QueueItem): Promise<void> {
    const result = await retryMutation.mutateAsync({
      proposal: item.id,
    });
    await refreshQueueList();
    flash(
      result.status === "already_processing" ? (
        <div>
          <strong className="font-bold">{item.price.name}</strong> is already
          processing.
        </div>
      ) : (
        <div>
          Requeued <strong className="font-bold">{item.price.name}</strong>
        </div>
      ),
    );
  }

  async function handleApplyCreateProposal(item: QueueItem): Promise<void> {
    const created = await createBottleMutation.mutateAsync({
      proposal: item.id,
      bottle: item.proposedBottle || undefined,
      release: item.proposedRelease || undefined,
    });
    await refreshQueueList();
    flash(
      <div>
        Created{" "}
        <Link href={`/bottles/${created.bottle.id}`} className="underline">
          {created.bottle.fullName}
        </Link>
        {created.release ? (
          <>
            {" "}
            and{" "}
            <Link
              href={getBottleBottlingPath(
                created.bottle.id,
                created.release.id,
              )}
              className="underline"
            >
              {created.release.fullName}
            </Link>
          </>
        ) : null}{" "}
        for <strong className="font-bold">{item.price.name}</strong>
      </div>,
    );
  }

  async function handleApplyBottleRepair(item: QueueItem): Promise<void> {
    const bottle = await applyBottleRepairMutation.mutateAsync({
      proposal: item.id,
    });
    await refreshQueueList();
    flash(
      <div>
        Applied repair to{" "}
        <Link href={`/bottles/${bottle.id}`} className="underline">
          {bottle.fullName}
        </Link>{" "}
        for <strong className="font-bold">{item.price.name}</strong>
      </div>,
    );
  }

  async function handleIgnore(item: QueueItem): Promise<void> {
    await resolveMutation.mutateAsync({
      proposal: item.id,
      action: "ignore",
    });
    await refreshQueueList();
    flash(
      <div>
        Ignored <strong className="font-bold">{item.price.name}</strong>
      </div>,
    );
  }

  async function handleBottleSelection(bottle: {
    fullName: string;
    id: number;
  }): Promise<void> {
    if (!selectedProposal) {
      return;
    }

    await resolveMutation.mutateAsync({
      proposal: selectedProposal.id,
      action: "match",
      bottle: bottle.id,
    });
    await refreshQueueList();
    flash(
      <div>
        Assigned{" "}
        <strong className="font-bold">{selectedProposal.price.name}</strong> to{" "}
        <Link href={`/bottles/${bottle.id}`} className="underline">
          {bottle.fullName}
        </Link>
      </div>,
    );
    setSelectedProposal(null);
  }

  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Incoming Listings",
            href: "/admin/queue",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Incoming Listings</SimpleHeader>

      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
          Review new or changed retailer listings here. Use this queue when the
          listing is unmatched, misclassified, or needs a bottle or bottling
          decision. If the underlying catalog bottle itself is wrong, switch to
          one of the repair queues below instead of forcing the listing to carry
          that cleanup.
        </div>

        <AdminWorkstreamTabs />

        <Form
          action={pathname}
          className="mb-0 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4"
        >
          <input type="hidden" name="state" value={currentState} />
          <input type="hidden" name="sort" value={currentSort} />
          {currentKind ? (
            <input type="hidden" name="kind" value={currentKind} />
          ) : null}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <TextInput
                type="text"
                name="query"
                defaultValue={currentQuery}
                placeholder="Search incoming listings"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" color="primary">
                Search
              </Button>
              {currentQuery ? (
                <Button
                  href={buildQueueHref(pathname, searchParams, {
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

        <div className="flex flex-wrap gap-2">
          {QUEUE_STATE_OPTIONS.map((option) => {
            const count =
              option.id === "actionable"
                ? proposalList.stats.actionableCount
                : proposalList.stats.processingCount;

            return (
              <Button
                key={option.id}
                href={buildQueueHref(pathname, searchParams, {
                  state: option.id,
                  cursor: null,
                })}
                size="small"
                active={currentState === option.id}
              >
                {option.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUEUE_KIND_OPTIONS.map((option) => (
            <Button
              key={option.label}
              href={buildQueueHref(pathname, searchParams, {
                kind: option.id,
                cursor: null,
              })}
              size="small"
              active={currentKind === option.id}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUEUE_SORT_OPTIONS.map((option) => (
            <Button
              key={option.id}
              href={buildQueueHref(pathname, searchParams, {
                sort: option.id === DEFAULT_QUEUE_SORT ? null : option.id,
                cursor: null,
              })}
              size="small"
              active={currentSort === option.id}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {canRetryAll ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-300">
              {actionableCount > 0
                ? `${actionableCount} actionable result${actionableCount === 1 ? "" : "s"} match the current search and filter settings. Retry runs process in small background batches with web search disabled.`
                : "No actionable results match the current search and filter settings."}
            </div>
            <Button
              color="primary"
              disabled={isBusy || retryRunIsActive || actionableCount === 0}
              onClick={handleRetryAll}
            >
              Start Background Retry
            </Button>
          </div>
        ) : null}

        {activeRetryRun ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  Retry run #{activeRetryRun.id}: {activeRetryRun.status}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {activeRetryRun.processedCount} of{" "}
                  {activeRetryRun.matchedCount} processed.{" "}
                  {activeRetryRun.resolvedCount} resolved,{" "}
                  {activeRetryRun.reviewableCount} still reviewable,{" "}
                  {activeRetryRun.erroredCount} errored,{" "}
                  {activeRetryRun.skippedCount} skipped.
                </div>
              </div>
              {retryRunIsActive ? (
                <Button
                  disabled={isBusy || activeRetryRun.cancelRequestedAt !== null}
                  onClick={handleCancelRetryRun}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="bg-highlight h-full transition-all"
                style={{ width: `${activeRetryRun.progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {proposalList.results.length > 0 ? (
        <div className="space-y-4">
          {proposalList.results.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              isBusy={isBusy}
              returnTo={returnTo}
              onApproveMatch={handleApproveMatch}
              onApplyCreateProposal={handleApplyCreateProposal}
              onApplyBottleRepair={handleApplyBottleRepair}
              onChooseBottle={(nextProposal) => {
                setSelectedProposal(nextProposal);
              }}
              onRetry={handleRetry}
              onIgnore={handleIgnore}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-300">
          {currentState === "processing"
            ? "No processing items match the current search and filter settings."
            : "No actionable queue items match the current search and filter settings."}
        </div>
      )}

      <PaginationButtons rel={proposalList.rel} />

      <BottleSelector
        open={!!selectedProposal}
        name={selectedProposal?.price.name}
        source={selectedProposal?.price.url}
        returnTo={returnTo}
        onClose={() => {
          setSelectedProposal(null);
        }}
        onSelect={handleBottleSelection}
      />
    </>
  );
}
