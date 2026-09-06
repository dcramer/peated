import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import {
  getMemberReviewSeoMetadata,
  serializeMemberReviewStructuredData,
} from "@peated/web/lib/reviewSeo";
import { cache } from "react";

import { ReviewDetail, ReviewRail } from "./reviewDetail.stylex";

const getReview = cache(async (reviewId: number) => {
  const { client } = await getPublicPageServerClient();
  return await resolveOrNotFound(
    client.memberReviews.details({ review: reviewId }),
  );
});

export async function generateMetadata(props: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await props.params;
  const review = await getReview(Number(reviewId));
  return getMemberReviewSeoMetadata(review);
}

export default async function ReviewPage(props: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await props.params;
  const review = await getReview(Number(reviewId));
  const structuredData = serializeMemberReviewStructuredData(review);
  const { client } = await getPublicPageServerClient();
  const [memberTastings, memberReviews, externalReviews] = await Promise.all([
    client.tastings.list({ user: review.createdBy.id, limit: 4 }),
    client.memberReviews.list({ bottle: review.bottle.id, limit: 4 }),
    client.externalReviews.list({ bottle: review.bottle.id, limit: 4 }),
  ]);

  return (
    <PageColumns
      rail={
        <ReviewRail
          externalReviews={externalReviews.results}
          memberReviews={memberReviews.results}
          memberTastings={memberTastings.results}
          review={review}
        />
      }
      railBehavior="stack"
    >
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      )}
      <ReviewDetail review={review} />
    </PageColumns>
  );
}
