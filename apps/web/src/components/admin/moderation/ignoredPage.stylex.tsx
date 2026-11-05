"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminMetadataList,
  AdminSection,
  AdminStatus,
} from "@peated/web/components/admin/adminContent.stylex";
import {
  AdminFormGrid,
  AdminSelectField,
  AdminTextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { AdminTable } from "@peated/web/components/admin/adminTable.stylex";
import { Timestamp } from "@peated/web/components/timestamp";
import { useORPC } from "@peated/web/lib/orpc/context";
import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, space } from "../../../styles/tokens.stylex";

type IgnoredSource =
  Outputs["admin"]["moderation"]["listIgnored"]["results"][number];

const KIND_LABELS = {
  listing: "Store listing",
  auction_lot: "Auction lot",
  external_review: "Review",
} satisfies Record<IgnoredSource["kind"], string>;

/** Reopens a listing at the proposal and source versions read just now. */
export function listingReopenInput(
  proposalId: number,
  details: {
    updatedAt: string;
    price: { sourceFingerprint: string | null };
  },
): Inputs["prices"]["matchQueue"]["reopen"] {
  return {
    proposal: proposalId,
    expectedUpdatedAt: details.updatedAt,
    expectedSourceFingerprint: details.price.sourceFingerprint,
  };
}

/** Reopens an auction lot at the source and check versions read just now. */
export function auctionLotReopenInput(
  lotId: number,
  details: { fingerprint: string; matchCheckId: number | null },
): Inputs["auctions"]["reopen"] {
  return {
    lot: lotId,
    fingerprint: details.fingerprint,
    expectedCheckId: details.matchCheckId,
  };
}

/**
 * Sources that are ignored now, so a moderator can find a wrong ignore and
 * send it back to review. Listings and auction lots reopen in place; a review
 * opens its Inbox task, where a moderator can assign a Bottle.
 */
export default function IgnoredPage() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const query = searchParams.get("query");
  const kind = searchParams.get("kind");
  const ignoredBy = searchParams.get("ignoredBy");
  const input: NonNullable<Inputs["admin"]["moderation"]["listIgnored"]> = {
    cursor: Number(searchParams.get("cursor") ?? 1),
    limit: 50,
  };
  if (query) input.query = query;
  if (
    kind === "listing" ||
    kind === "auction_lot" ||
    kind === "external_review"
  )
    input.kind = kind;
  if (ignoredBy === "automatic" || ignoredBy === "moderator")
    input.ignoredBy = ignoredBy;
  const { data } = useSuspenseQuery(
    orpc.admin.moderation.listIgnored.queryOptions({ input }),
  );
  const reopenListing = useMutation(
    orpc.prices.matchQueue.reopen.mutationOptions(),
  );
  const reopenLot = useMutation(orpc.auctions.reopen.mutationOptions());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "danger" | "success";
    text: string;
  } | null>(null);

  async function reopen(item: IgnoredSource) {
    setPendingKey(item.key);
    setMessage(null);
    try {
      // Reopen sends the versions the source has now, read just before, so a
      // source that changed since the list loaded is not reopened blindly.
      if (item.source.kind === "listing") {
        const details = await queryClient.fetchQuery(
          orpc.prices.matchQueue.details.queryOptions({
            input: { proposal: item.source.proposalId },
          }),
        );
        await reopenListing.mutateAsync(
          listingReopenInput(item.source.proposalId, details),
        );
      } else if (item.source.kind === "auction_lot") {
        const details = await queryClient.fetchQuery(
          orpc.auctions.details.queryOptions({
            input: { lot: item.source.lotId },
          }),
        );
        await reopenLot.mutateAsync(
          auctionLotReopenInput(item.source.lotId, details),
        );
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.admin.moderation.key(),
      });
      setMessage({
        tone: "success",
        text: `${item.title} is back in the Inbox for review.`,
      });
    } catch (cause) {
      setMessage({
        tone: "danger",
        text:
          cause instanceof Error
            ? cause.message
            : "It could not be reopened. Try again.",
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <AdminSection
      title="Ignored"
      description="Store listings, auction lots, and reviews that are ignored now, newest first. Reopen a wrong ignore to send it back to the Inbox."
    >
      <form action="/admin/moderation/ignored">
        <AdminFormGrid>
          <AdminTextField
            defaultValue={query ?? ""}
            label="Search"
            name="query"
            placeholder="Search titles and reasons"
          />
          <AdminSelectField
            defaultValue={kind ?? ""}
            label="Source"
            name="kind"
            options={[
              { value: "", label: "All sources" },
              { value: "listing", label: "Store listings" },
              { value: "auction_lot", label: "Auction lots" },
              { value: "external_review", label: "Reviews" },
            ]}
          />
          <AdminSelectField
            defaultValue={ignoredBy ?? ""}
            label="Ignored by"
            name="ignoredBy"
            options={[
              { value: "", label: "Anyone" },
              { value: "automatic", label: "Classifier" },
              { value: "moderator", label: "Moderator" },
            ]}
          />
          <Button type="submit">Apply filters</Button>
        </AdminFormGrid>
      </form>
      {message ? (
        <AdminStatus tone={message.tone}>{message.text}</AdminStatus>
      ) : null}
      {data.results.length ? (
        <AdminTable
          caption="Ignored sources"
          items={data.results}
          primaryKey={(item) => item.key}
          rel={data.rel}
          columns={[
            {
              name: "source",
              value: (item) => <IgnoredSourceSummary item={item} />,
            },
            {
              name: "actions",
              title: "",
              showOnMobile: true,
              value: (item) => (
                <AdminActions>
                  {item.source.kind === "external_review" ? (
                    <Button
                      href={`/admin/moderation/inbox/external_review/${item.source.reviewId}`}
                      size="sm"
                    >
                      Review
                    </Button>
                  ) : (
                    <Button
                      disabled={pendingKey !== null}
                      loading={pendingKey === item.key}
                      onClick={() => void reopen(item)}
                      size="sm"
                    >
                      Reopen
                    </Button>
                  )}
                  {item.url ? (
                    <Button href={item.url} size="sm" variant="quiet">
                      Open source
                    </Button>
                  ) : null}
                </AdminActions>
              ),
            },
          ]}
        />
      ) : (
        "No ignored sources match these filters."
      )}
    </AdminSection>
  );
}

function IgnoredSourceSummary({ item }: { item: IgnoredSource }) {
  return (
    <div {...stylex.props(styles.summary)}>
      <strong>{item.title}</strong>
      <AdminMetadataList
        items={[
          KIND_LABELS[item.kind],
          item.sourceLabel,
          item.ignoredBy
            ? `Ignored by ${item.ignoredBy}`
            : "Ignored by the classifier",
          <Timestamp key="ignoredAt" date={item.ignoredAt} format="dateTime" />,
        ]}
      />
      <span {...stylex.props(foundationStyles.body, styles.reason)}>
        {item.reason ?? "No reason saved."}
      </span>
    </div>
  );
}

const styles = stylex.create({
  summary: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  reason: {
    color: colors.inkMuted,
  },
});
