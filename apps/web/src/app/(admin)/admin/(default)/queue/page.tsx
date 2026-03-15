"use client";

import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import Form from "@peated/web/components/form";
import Link from "@peated/web/components/link";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import TextInput from "@peated/web/components/textInput";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import BottleSelector from "./bottleSelector";
import QueueItemCard, { type QueueItem } from "./queueItemCard";

type QueueKind = "create_new" | "match_existing" | "correction" | "errored";
type QueueState = "actionable" | "processing";

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

  const resolveMutation = useMutation(
    orpc.prices.matchQueue.resolve.mutationOptions(),
  );
  const retryMutation = useMutation(
    orpc.prices.matchQueue.retry.mutationOptions(),
  );
  const retryAllMutation = useMutation(
    orpc.prices.matchQueue.retryAll.mutationOptions(),
  );

  const { flash } = useFlashMessages();
  const isBusy =
    resolveMutation.isPending ||
    retryMutation.isPending ||
    retryAllMutation.isPending;
  const canRetryAll = currentState === "actionable";
  const actionableCount = proposalList.stats.actionableCount;

  async function refreshQueueList(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: listQueryOptions.queryKey,
    });
  }

  async function handleRetryAll(): Promise<void> {
    if (
      !window.confirm(
        `Retry ${actionableCount} actionable search result${actionableCount === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }

    const result = await retryAllMutation.mutateAsync({
      query: currentQuery,
      kind: currentKind,
    });
    await refreshQueueList();
    flash(
      <div>
        Queued <strong className="font-bold">{result.enqueuedCount}</strong>{" "}
        {result.enqueuedCount === 1 ? "retry." : "retries."}
        {result.alreadyProcessingCount > 0
          ? ` ${result.alreadyProcessingCount} skipped because they were already processing.`
          : ""}
        {result.enqueueFailedCount > 0
          ? ` ${result.enqueueFailedCount} failed to enqueue.`
          : ""}
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
      <SimpleHeader>Price Match Queue</SimpleHeader>

      <div className="mb-6 space-y-4">
        <Form
          action={pathname}
          className="mb-0 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4"
        >
          <input type="hidden" name="state" value={currentState} />
          {currentKind ? (
            <input type="hidden" name="kind" value={currentKind} />
          ) : null}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <TextInput
                type="text"
                name="query"
                defaultValue={currentQuery}
                placeholder="Search queue by listing name"
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

        {canRetryAll ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-300">
              {actionableCount > 0
                ? `${actionableCount} actionable result${actionableCount === 1 ? "" : "s"} match the current search and filter settings.`
                : "No actionable results match the current search and filter settings."}
            </div>
            <Button
              color="primary"
              disabled={isBusy || actionableCount === 0}
              onClick={handleRetryAll}
            >
              Retry All Search Results
            </Button>
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
