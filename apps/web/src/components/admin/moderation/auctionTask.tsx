"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminCodeBlock,
  AdminDetails,
  AdminSection,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminAlert as Alert } from "@peated/web/components/admin/adminUtility.stylex";
import { BottleIdentityRow } from "@peated/web/components/bottleIdentityRow.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
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
  ModerationReasonList,
  ModerationStack,
  ModerationTaskHeader,
} from "./moderationDetail.stylex";

type Item = Outputs["auctions"]["details"];
type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];

export function auctionLotAssignment(
  item: {
    lot: Pick<Item["lot"], "id" | "bottleId">;
    fingerprint: string;
    matchCheckId: number | null;
    suggestedBottle: { id: number } | null;
    canRememberReference: boolean;
  },
  bottleId: number,
  rememberReference = false,
): Inputs["auctions"]["match"] {
  if (
    rememberReference &&
    (!item.canRememberReference || item.suggestedBottle?.id !== bottleId)
  )
    throw new Error(
      "Only the suggested bottle can be remembered for this name.",
    );
  return {
    lot: item.lot.id,
    bottleId,
    fingerprint: item.fingerprint,
    expectedBottleId: item.lot.bottleId,
    expectedCheckId: item.matchCheckId,
    rememberReference,
  };
}

/** Reviews one sale occurrence; learning a reusable name is a separate explicit action. */
export default function AuctionTask({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (message: string) => Promise<void>;
}) {
  if (task.source.kind !== "auction_lot")
    throw new Error("AuctionTask requires an auction lot.");
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: item } = useSuspenseQuery(
    orpc.auctions.details.queryOptions({ input: { lot: task.source.lotId } }),
  );
  const match = useMutation(orpc.auctions.match.mutationOptions());
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(bottleId: number, remember = false) {
    setError(null);
    try {
      await match.mutateAsync(auctionLotAssignment(item, bottleId, remember));
      await queryClient.invalidateQueries({ queryKey: orpc.auctions.key() });
      await onComplete(
        remember
          ? "Lot assigned. This name can now match future listings."
          : "Auction lot assigned.",
      );
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
      <TextLink href={item.lot.url} target="_blank" rel="noreferrer">
        View auction lot
      </TextLink>
      <p>
        {item.lot.state === "closed" || item.lot.state === "withdrawn"
          ? "This lot has ended. Matching it adds sale history, not an auction alert."
          : "Assign this sale to an existing bottle in the catalog."}
      </p>
      {item.currentBottle ? (
        <AdminSection title="Current bottle">
          <BottleIdentityRow {...toBottleListItem(item.currentBottle)} />
        </AdminSection>
      ) : null}
      {item.suggestedBottle ? (
        <AdminSection title="Suggested bottle">
          <BottleIdentityRow {...toBottleListItem(item.suggestedBottle)} />
        </AdminSection>
      ) : null}
      {item.decision?.rationale ? <p>{item.decision.rationale}</p> : null}
      {item.decision?.confidenceBasis?.unresolvedRisks.length ? (
        <ModerationReasonList>
          {item.decision.confidenceBasis.unresolvedRisks.map((risk, index) => (
            <li key={index}>{risk.note}</li>
          ))}
        </ModerationReasonList>
      ) : null}
      {item.decision?.action === "create_bottle" ? (
        <AdminSection title="Missing bottle">
          <p>
            The saved proposal needs separate catalog review. It will not create
            a bottle here.
          </p>
          <AdminCodeBlock>
            {JSON.stringify(item.decision.proposedBottle, null, 2)}
          </AdminCodeBlock>
        </AdminSection>
      ) : null}
      {error ? <Alert type="error">{error}</Alert> : null}
      <ModerationActions>
        {item.suggestedBottle ? (
          <Button
            variant="accent"
            disabled={match.isPending}
            loading={match.isPending}
            onClick={() => void assign(item.suggestedBottle!.id)}
          >
            Assign this lot
          </Button>
        ) : null}
        <Button disabled={match.isPending} onClick={() => setSelecting(true)}>
          Choose another bottle
        </Button>
        {item.canRememberReference && item.suggestedBottle ? (
          <Button
            disabled={match.isPending}
            onClick={() => void assign(item.suggestedBottle!.id, true)}
          >
            Assign and remember name
          </Button>
        ) : null}
      </ModerationActions>
      {item.canRememberReference ? (
        <p>
          Remembering accepts this exact name for future listings. Assigning
          only this lot does not teach future matching.
        </p>
      ) : null}
      <AdminDetails summary="Source facts">
        <AdminCodeBlock>
          {JSON.stringify(
            {
              volume: item.lot.volume,
              condition: item.lot.condition,
              imageUrl: item.sourceImageUrl,
              detailsRequestedAt: item.sourceDetailsRequestedAt,
              detailsCheckedAt: item.sourceDetailsCheckedAt,
              detailsRunId: item.sourceDetailsRunId,
              identity: item.sourceBottleIdentity,
            },
            null,
            2,
          )}
        </AdminCodeBlock>
      </AdminDetails>
      <AdminDetails summary="Saved evidence">
        <AdminCodeBlock>
          {JSON.stringify(item.artifacts, null, 2)}
        </AdminCodeBlock>
      </AdminDetails>
      <BottleSelector
        open={selecting}
        name={item.lot.name}
        source={item.lot.url}
        onClose={() => setSelecting(false)}
        onSelect={async (bottle: Bottle) => {
          await assign(bottle.id);
        }}
      />
    </ModerationStack>
  );
}
