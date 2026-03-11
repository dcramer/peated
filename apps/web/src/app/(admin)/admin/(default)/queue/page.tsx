"use client";

import type { Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import Link from "@peated/web/components/link";
import SimpleHeader from "@peated/web/components/simpleHeader";
import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState } from "react";
import BottleSelector from "./bottleSelector";

type QueueItem = Outputs["prices"]["matchQueue"]["list"]["results"][number];

export default function Page() {
  const pathname = usePathname();
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

  const { flash } = useFlashMessages();

  return (
    <>
      <SimpleHeader>Price Match Queue</SimpleHeader>
      <Table
        items={proposalList.results}
        rel={proposalList.rel}
        primaryKey={(item) => String(item.id)}
        columns={[
          {
            name: "listing",
            value: (item) => (
              <div className="space-y-1">
                <div className="font-bold">{item.price.name}</div>
                <div className="text-muted text-sm">
                  <Link
                    href={item.price.url}
                    target="_blank"
                    className="underline"
                  >
                    {item.price.site.name}
                  </Link>
                </div>
                {item.currentBottle ? (
                  <div className="text-sm">
                    Current:{" "}
                    <Link
                      href={`/bottles/${item.currentBottle.id}`}
                      className="underline"
                    >
                      {item.currentBottle.fullName}
                    </Link>
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            name: "suggestion",
            value: (item) => (
              <div className="space-y-1">
                <div className="font-semibold capitalize">
                  {item.status === "errored"
                    ? "Errored"
                    : item.proposalType.replaceAll("_", " ")}
                </div>
                {item.suggestedBottle ? (
                  <div className="text-sm">
                    <Link
                      href={`/bottles/${item.suggestedBottle.id}`}
                      className="underline"
                    >
                      {item.suggestedBottle.fullName}
                    </Link>
                  </div>
                ) : item.proposedBottle?.name ? (
                  <div className="text-sm">
                    New bottle: {item.proposedBottle.name}
                  </div>
                ) : item.status === "errored" ? (
                  <div className="text-sm">Classifier failed</div>
                ) : (
                  <div className="text-sm">No strong suggestion</div>
                )}
                <div className="text-muted text-sm">
                  Confidence:{" "}
                  {item.status === "errored" ? "n/a" : (item.confidence ?? "?")}
                </div>
                {item.status === "errored" && item.error ? (
                  <div className="text-muted line-clamp-3 max-w-md text-sm">
                    {item.error}
                  </div>
                ) : item.rationale ? (
                  <div className="text-muted line-clamp-3 max-w-md text-sm">
                    {item.rationale}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            name: "actions",
            value: (item) => (
              <div className="flex flex-col gap-2">
                {item.suggestedBottle ? (
                  <Button
                    onClick={async () => {
                      const suggestedBottle = item.suggestedBottle;
                      if (!suggestedBottle) return;
                      await resolveMutation.mutateAsync({
                        proposal: item.id,
                        action: "match",
                        bottle: suggestedBottle.id,
                      });
                      await queryClient.invalidateQueries({
                        queryKey: listQueryOptions.queryKey,
                      });
                      flash(
                        <div>
                          Approved match for{" "}
                          <strong className="font-bold">
                            {item.price.name}
                          </strong>
                        </div>,
                      );
                    }}
                    disabled={resolveMutation.isPending}
                  >
                    Approve Match
                  </Button>
                ) : null}

                <Button
                  onClick={() => {
                    setSelectedProposal(item);
                  }}
                  disabled={resolveMutation.isPending}
                >
                  Choose Bottle
                </Button>

                {item.proposedBottle ? (
                  <Link
                    href={`/addBottle?proposal=${item.id}&returnTo=${encodeURIComponent(pathname)}`}
                    className="text-sm underline"
                  >
                    Create Bottle
                  </Link>
                ) : null}

                <Button
                  onClick={async () => {
                    await retryMutation.mutateAsync({
                      proposal: item.id,
                    });
                    await queryClient.invalidateQueries({
                      queryKey: listQueryOptions.queryKey,
                    });
                    flash(
                      <div>
                        Requeued{" "}
                        <strong className="font-bold">{item.price.name}</strong>
                      </div>,
                    );
                  }}
                  disabled={retryMutation.isPending}
                >
                  Retry
                </Button>

                <Button
                  onClick={async () => {
                    await resolveMutation.mutateAsync({
                      proposal: item.id,
                      action: "ignore",
                    });
                    await queryClient.invalidateQueries({
                      queryKey: listQueryOptions.queryKey,
                    });
                    flash(
                      <div>
                        Ignored{" "}
                        <strong className="font-bold">{item.price.name}</strong>
                      </div>,
                    );
                  }}
                  disabled={resolveMutation.isPending}
                >
                  Ignore
                </Button>
              </div>
            ),
          },
        ]}
      />

      <BottleSelector
        open={!!selectedProposal}
        name={selectedProposal?.price.name}
        source={selectedProposal?.price.url}
        returnTo={pathname}
        onClose={() => {
          setSelectedProposal(null);
        }}
        onSelect={async (bottle) => {
          if (!selectedProposal) return;
          await resolveMutation.mutateAsync({
            proposal: selectedProposal.id,
            action: "match",
            bottle: bottle.id,
          });
          await queryClient.invalidateQueries({
            queryKey: listQueryOptions.queryKey,
          });
          flash(
            <div>
              Assigned{" "}
              <strong className="font-bold">
                {selectedProposal.price.name}
              </strong>{" "}
              to{" "}
              <Link href={`/bottles/${bottle.id}`} className="underline">
                {bottle.fullName}
              </Link>
            </div>,
          );
          setSelectedProposal(null);
        }}
      />
    </>
  );
}
