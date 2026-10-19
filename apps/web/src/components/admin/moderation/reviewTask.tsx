"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminCodeBlock,
  AdminDetails,
  AdminSection,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTextareaField } from "@peated/web/components/admin/adminForm.stylex";
import { AdminAlert as Alert } from "@peated/web/components/admin/adminUtility.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import BottleSelector from "./bottleSelector";
import {
  ModerationActions,
  ModerationStack,
  ModerationTaskHeader,
} from "./moderationDetail.stylex";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];
type Item = Outputs["externalReviews"]["resolution"];

export function reviewAssignment(
  item: {
    review: Pick<Item["review"], "id" | "name" | "bottle">;
    attemptedAt: Item["attemptedAt"];
  },
  bottleId: number,
): Inputs["externalReviews"]["update"] {
  if (item.review.bottle !== null || item.attemptedAt === null)
    throw new Error("This review is no longer waiting for a bottle decision.");
  return {
    externalReview: item.review.id,
    bottle: bottleId,
    expectedResolution: {
      name: item.review.name,
      attemptedAt: item.attemptedAt,
    },
  };
}

/** A review keeps its own source title; a moderator assigns its Bottle separately. */
export default function ReviewTask({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (message: string) => Promise<void>;
}) {
  if (task.source.kind !== "external_review")
    throw new Error("ReviewTask requires an external review.");
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: item } = useSuspenseQuery(
    orpc.externalReviews.resolution.queryOptions({
      input: { externalReview: task.source.reviewId },
    }),
  );
  const update = useMutation(orpc.externalReviews.update.mutationOptions());
  const recheck = useMutation(orpc.externalReviews.recheck.mutationOptions());
  const remove = useMutation(orpc.admin.content.moderate.mutationOptions());
  const [selecting, setSelecting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const output = item.check?.output;
  const decision = output?.status === "classified" ? output.decision : null;
  const busy = update.isPending || recheck.isPending || remove.isPending;

  async function finish<TResult>(
    action: () => Promise<TResult>,
    message: string,
  ) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: orpc.externalReviews.key(),
      });
      await onComplete(message);
      setSelecting(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The decision could not be saved. Try again.",
      );
    }
  }

  return (
    <ModerationStack>
      <ModerationTaskHeader
        blocked={task.state === "blocked"}
        category={task.category}
        meta={
          <>
            {task.title} · {task.sourceLabel}
          </>
        }
        question={task.question}
        status={task.statusLabel}
        taskKey={task.key}
      />
      <TextLink href={item.review.url} target="_blank" rel="noreferrer">
        Read the source review
      </TextLink>
      <p>
        Choose the bottle reviewed here, or check the match again after a
        catalog correction.
      </p>
      {output?.status === "ignored" ? (
        <p>{output.reason}</p>
      ) : decision?.rationale ? (
        <p>{decision.rationale}</p>
      ) : (
        <p>No supported matching decision is available.</p>
      )}
      {decision?.confidenceBasis?.unresolvedRisks.length ? (
        <ul>
          {decision.confidenceBasis.unresolvedRisks.map((risk, index) => (
            <li key={index}>{risk.note}</li>
          ))}
        </ul>
      ) : null}
      {decision?.action === "create_bottle" ? (
        <AdminSection title="Missing bottle">
          <p>
            The saved proposal needs catalog review before this review can be
            assigned.
          </p>
          <TextLink href="/addBottle" target="_blank">
            Add a bottle
          </TextLink>
          <AdminDetails summary="Proposed bottle">
            <AdminCodeBlock>
              {JSON.stringify(decision.proposedBottle, null, 2)}
            </AdminCodeBlock>
          </AdminDetails>
        </AdminSection>
      ) : null}
      {error ? <Alert type="error">{error}</Alert> : null}
      <ModerationActions>
        <Button
          variant="accent"
          disabled={busy}
          onClick={() => setSelecting(true)}
        >
          Choose a bottle
        </Button>
        <Button
          disabled={busy || item.attemptedAt === null}
          loading={recheck.isPending}
          onClick={() =>
            void finish(async () => {
              if (item.attemptedAt === null)
                throw new Error("This review is already waiting for matching.");
              await recheck.mutateAsync({
                reviews: [
                  {
                    reviewId: item.review.id,
                    name: item.review.name,
                    attemptedAt: item.attemptedAt,
                  },
                ],
              });
            }, "Review queued for matching.")
          }
        >
          Check match again
        </Button>
      </ModerationActions>
      <AdminSection title="Remove an unsuitable review">
        {removing ? (
          <>
            <AdminTextareaField
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Button
              disabled={busy || !reason.trim()}
              loading={remove.isPending}
              onClick={() =>
                void finish(
                  () =>
                    remove.mutateAsync({
                      kind: "external_review",
                      id: item.review.id,
                      removed: true,
                      reason: reason.trim(),
                    }),
                  "Review removed.",
                )
              }
            >
              Remove review
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={() => setRemoving(true)}>
            Remove review
          </Button>
        )}
      </AdminSection>
      <AdminDetails summary="Saved evidence">
        <AdminCodeBlock>
          {JSON.stringify(item.check?.artifacts ?? null, null, 2)}
        </AdminCodeBlock>
      </AdminDetails>
      <BottleSelector
        open={selecting}
        name={item.review.name}
        source={item.review.url}
        onClose={() => setSelecting(false)}
        onSelect={async (bottle) => {
          await finish(
            () => update.mutateAsync(reviewAssignment(item, bottle.id)),
            "Review assigned.",
          );
        }}
      />
    </ModerationStack>
  );
}
