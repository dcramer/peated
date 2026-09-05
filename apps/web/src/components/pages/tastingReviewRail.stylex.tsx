import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  type BottleListItem,
  LoadingList,
  RailList,
  RailListItem,
  TastingRating,
} from "@peated/web/components";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getTastingUrl } from "@peated/web/lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { BottleRailSection } from "./bottleRailSection.stylex";
import { RailListSection } from "./railListSection.stylex";
import {
  TastingReviewBottleSummary,
  TastingReviewBottleSummaryLoading,
} from "./tastingReviewBottleSummary.stylex";

type Bottle = Outputs["tastings"]["details"]["bottle"];
type Member = Outputs["tastings"]["details"]["createdBy"];
type MemberReview = Outputs["memberReviews"]["list"]["results"][number];
type ExternalReview = Outputs["externalReviews"]["list"]["results"][number];
type Tasting = Outputs["tastings"]["list"]["results"][number];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function TastingReviewRailLayout({
  bottle,
  memberContent,
  memberHeading,
  memberItems,
  memberMoreHref,
  memberMoreLabel,
  reviewContent,
}: {
  bottle: ReactNode;
  memberContent?: ReactNode;
  memberHeading: string;
  memberItems?: readonly BottleListItem[];
  memberMoreHref?: string;
  memberMoreLabel?: string;
  reviewContent: ReactNode;
}) {
  return (
    <>
      {bottle}
      <BottleRailSection
        heading={memberHeading}
        items={memberItems}
        moreHref={memberMoreHref}
        moreLabel={memberMoreLabel}
      >
        {memberContent}
      </BottleRailSection>
      <RailListSection heading="Other reviews of this bottle">
        {reviewContent}
      </RailListSection>
    </>
  );
}

export function TastingReviewRail({
  author,
  bottle,
  currentReviewId,
  currentTastingId,
  externalReviews,
  photoUrl,
  memberReviews,
  memberTastings,
}: {
  author: Member;
  bottle: Bottle;
  currentReviewId?: number;
  currentTastingId?: number;
  externalReviews: readonly ExternalReview[];
  photoUrl?: string | null;
  memberReviews: readonly MemberReview[];
  memberTastings: readonly Tasting[];
}) {
  const moreFromMember = memberTastings
    .filter((tasting) => tasting.id !== currentTastingId)
    .slice(0, 4);
  const otherMemberReviews = memberReviews
    .filter((review) => review.id !== currentReviewId)
    .slice(0, 3);
  const otherExternalReviews = externalReviews.slice(
    0,
    Math.max(0, 5 - otherMemberReviews.length),
  );

  return (
    <TastingReviewRailLayout
      bottle={
        <TastingReviewBottleSummary
          bottle={bottle}
          photoUrl={photoUrl}
          placement="desktop"
        />
      }
      memberContent={
        !moreFromMember.length ? (
          <p {...stylex.props(foundationStyles.metadata, styles.empty)}>
            No other public tastings yet.
          </p>
        ) : undefined
      }
      memberHeading={`More from ${author.username}`}
      memberItems={moreFromMember.map((tasting) => ({
        ...toBottleListItem(tasting.bottle),
        id: String(tasting.id),
        provenance: [],
        metadata: [],
        end: (
          <div {...stylex.props(styles.tastingMeta)}>
            {tasting.ratingBand ? (
              <TastingRating band={tasting.ratingBand} size="sm" />
            ) : null}
            <time
              dateTime={tasting.createdAt}
              {...stylex.props(foundationStyles.metadata, styles.tastingDate)}
            >
              {dateFormatter.format(new Date(tasting.createdAt))}
            </time>
          </div>
        ),
        href: getTastingUrl(tasting),
        imageFit: tasting.imageUrl ? "cover" : "contain",
        imageUrl: tasting.imageUrl ?? tasting.bottle.imageUrl,
      }))}
      memberMoreHref={`/users/${author.username}/tastings`}
      memberMoreLabel="See all tastings"
      reviewContent={
        otherMemberReviews.length || otherExternalReviews.length ? (
          <RailList ariaLabel="Other reviews of this bottle">
            {otherMemberReviews.map((review) => (
              <RailListItem
                key={`member-${review.id}`}
                end={`${review.score}/100`}
                href={`/reviews/${review.id}`}
                metadata={`Member · ${dateFormatter.format(new Date(review.updatedAt))}`}
                title={review.createdBy.username}
              />
            ))}
            {otherExternalReviews.map((review) => (
              <RailListItem
                key={`external-${review.id}`}
                end={
                  review.nativeScore
                    ? `${review.nativeScore.value}/${review.nativeScore.scale}`
                    : undefined
                }
                href={review.url}
                metadata={
                  review.reviewerName
                    ? `${review.reviewerName} · ${formatPublishedDate(review)}`
                    : formatPublishedDate(review)
                }
                title={review.site?.name ?? review.article.title ?? review.name}
              />
            ))}
          </RailList>
        ) : (
          <p {...stylex.props(foundationStyles.metadata, styles.empty)}>
            No other reviews yet.
          </p>
        )
      }
    />
  );
}

/** Reserves the shared review and tasting side column while data loads. */
export function TastingReviewRailLoading() {
  return (
    <TastingReviewRailLayout
      bottle={<TastingReviewBottleSummaryLoading placement="desktop" />}
      memberContent={
        <LoadingList
          label="Loading member tastings"
          rows={3}
          variant="sidebar"
        />
      }
      memberHeading="More from this member"
      reviewContent={
        <LoadingList label="Loading other reviews" rows={3} variant="text" />
      }
    />
  );
}

function formatPublishedDate(review: ExternalReview) {
  const date = review.article.publishedAt ?? review.createdAt;
  return dateFormatter.format(new Date(date));
}

const styles = stylex.create({
  tastingMeta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.x2,
  },
  tastingDate: {
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  },
  empty: {
    margin: 0,
    paddingTop: space.x2,
    color: colors.inkMuted,
  },
});
