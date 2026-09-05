import type { Outputs } from "@peated/server/orpc/router";

import { TastingToastSummary } from "@peated/web/components";
import { TastingReviewDetail } from "@peated/web/components/pages/tastingReviewDetail.stylex";
import { TastingReviewRail } from "@peated/web/components/pages/tastingReviewRail.stylex";

import { TastingActions } from "./tastingActions";

type Tasting = Outputs["tastings"]["details"];
type TastingList = Outputs["tastings"]["list"]["results"];
type MemberReviewList = Outputs["memberReviews"]["list"]["results"];
type ExternalReviewList = Outputs["externalReviews"]["list"]["results"];

export function TastingDetail({
  canManage,
  tasting,
}: {
  canManage: boolean;
  tasting: Tasting;
}) {
  return (
    <TastingReviewDetail
      author={tasting.createdBy}
      bottle={tasting.bottle}
      color={tasting.color}
      createdAt={tasting.createdAt}
      footer={
        <TastingToastSummary
          authorId={tasting.createdBy.id}
          hasToasted={tasting.hasToasted}
          initialCount={tasting.toasts}
          tastingId={tasting.id}
        />
      }
      friends={tasting.friends}
      menu={canManage ? <TastingActions tasting={tasting} /> : undefined}
      notes={tasting.notes}
      photoUrl={tasting.imageUrl}
      rating={{ kind: "tasting", ratingBand: tasting.ratingBand }}
      servingStyle={tasting.servingStyle}
      tags={tasting.tags}
    />
  );
}

export function TastingRail({
  externalReviews,
  memberReviews,
  memberTastings,
  tasting,
}: {
  externalReviews: ExternalReviewList;
  memberReviews: MemberReviewList;
  memberTastings: TastingList;
  tasting: Tasting;
}) {
  return (
    <TastingReviewRail
      author={tasting.createdBy}
      bottle={tasting.bottle}
      currentTastingId={tasting.id}
      externalReviews={externalReviews}
      memberReviews={memberReviews}
      memberTastings={memberTastings}
      photoUrl={tasting.imageUrl}
    />
  );
}
