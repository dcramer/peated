import type { Outputs } from "@peated/server/orpc/router";

import { TastingReviewDetail } from "@peated/web/components/pages/tastingReviewDetail.stylex";
import { TastingReviewRail } from "@peated/web/components/pages/tastingReviewRail.stylex";

type Review = Outputs["memberReviews"]["details"];
type TastingList = Outputs["tastings"]["list"]["results"];
type MemberReviewList = Outputs["memberReviews"]["list"]["results"];
type ExternalReviewList = Outputs["externalReviews"]["list"]["results"];

export function ReviewDetail({ review }: { review: Review }) {
  return (
    <TastingReviewDetail
      author={review.createdBy}
      bottle={review.bottle}
      color={review.color}
      createdAt={review.createdAt}
      friends={review.friends}
      notes={review.notes}
      rating={{ kind: "review", score: review.score }}
      servingStyle={review.servingStyle}
      tags={review.tags}
    />
  );
}

export function ReviewRail({
  externalReviews,
  memberReviews,
  memberTastings,
  review,
}: {
  externalReviews: ExternalReviewList;
  memberReviews: MemberReviewList;
  memberTastings: TastingList;
  review: Review;
}) {
  return (
    <TastingReviewRail
      author={review.createdBy}
      bottle={review.bottle}
      currentReviewId={review.id}
      externalReviews={externalReviews}
      memberReviews={memberReviews}
      memberTastings={memberTastings}
      photoUrl={review.imageUrl}
    />
  );
}
