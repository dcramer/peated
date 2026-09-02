import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import {
  BottleVisual,
  RailList,
  RailListItem,
  TastingRating,
} from "@peated/web/components";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getBottleUrl } from "@peated/web/lib/urls";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { BottleRailSection } from "./bottleRailSection.stylex";
import { RailListSection } from "./railListSection.stylex";

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
  const bottleName = formatBottleDisplayName(bottle);
  const metadata = getBottleMetadata(bottle);
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
      {photoUrl ? (
        <figure {...stylex.props(styles.photo)}>
          <BottleVisual
            expandable
            imageUrl={photoUrl}
            label={`${bottleName} photo`}
            size="xl"
          />
        </figure>
      ) : null}

      <BottleRailSection
        heading="The bottle"
        items={[
          {
            href: getBottleUrl(bottle),
            imageUrl: bottle.imageUrl,
            metadata: metadata ?? undefined,
            name: bottleName,
          },
        ]}
      />

      <BottleRailSection
        heading={`More from ${author.username}`}
        items={moreFromMember.map((tasting) => ({
          end: tasting.ratingBand ? (
            <TastingRating band={tasting.ratingBand} />
          ) : undefined,
          href: `/tastings/${tasting.id}`,
          imageUrl: tasting.imageUrl ?? tasting.bottle.imageUrl,
          metadata: dateFormatter.format(new Date(tasting.createdAt)),
          name: formatBottleDisplayName(tasting.bottle),
        }))}
        moreHref={`/users/${author.username}/tastings`}
        moreLabel="See all tastings"
      >
        {!moreFromMember.length ? (
          <p {...stylex.props(styles.empty)}>No other public tastings yet.</p>
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
                  review.nativeScore?.scale === 100
                    ? review.nativeScore.value
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
          <p {...stylex.props(styles.empty)}>No other reviews yet.</p>
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
  photo: {
    minWidth: 0,
    margin: 0,
  },
  empty: {
    margin: 0,
    paddingTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
});
