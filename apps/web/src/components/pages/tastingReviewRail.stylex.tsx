import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import { RailList, RailListItem, TastingRating } from "@peated/web/components";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getTastingUrl } from "@peated/web/lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { BottleRailSection } from "./bottleRailSection.stylex";
import { RailListSection } from "./railListSection.stylex";
import { TastingReviewBottleSummary } from "./tastingReviewBottleSummary.stylex";

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
    <>
      <TastingReviewBottleSummary
        bottle={bottle}
        photoUrl={photoUrl}
        placement="desktop"
      />

      <BottleRailSection
        heading={`More from ${author.username}`}
        items={moreFromMember.map((tasting) => ({
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
          imageUrl: tasting.imageUrl ?? tasting.bottle.imageUrl,
        }))}
        moreHref={`/users/${author.username}/tastings`}
        moreLabel="See all tastings"
      >
        {!moreFromMember.length ? (
          <p {...stylex.props(foundationStyles.metadata, styles.empty)}>
            No other public tastings yet.
          </p>
        ) : null}
      </BottleRailSection>

      <RailListSection heading="Other reviews of this bottle">
        {otherMemberReviews.length || otherExternalReviews.length ? (
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
        )}
      </RailListSection>
    </>
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
