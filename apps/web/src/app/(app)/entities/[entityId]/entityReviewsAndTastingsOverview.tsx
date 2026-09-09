import type { Outputs } from "@peated/server/orpc/router";

import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import {
  LoadingList,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import { getReviewAndTastingFeedItems } from "@peated/web/lib/communityFeed";
import { getEntityUrl } from "@peated/web/lib/urls";

import type { Entity } from "./entityPageData";

type ReviewsAndTastings = Outputs["activity"]["reviewsAndTastings"];

export function EntityReviewsAndTastingsOverview({
  entity,
  error,
  pending,
  retry,
  reviewsAndTastings,
}: {
  entity: Entity;
  error: boolean;
  pending: boolean;
  retry: () => void;
  reviewsAndTastings?: ReviewsAndTastings;
}) {
  if (entity.kind !== "distillery") return null;

  if (pending) {
    return (
      <PageSection heading="Recent activity">
        <LoadingList
          label={`Loading recent ${entity.name} activity`}
          rows={3}
        />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading="Recent activity">
        <SectionError heading="Recent activity is unavailable" onRetry={retry}>
          The rest of this page still works. Try loading this activity again.
        </SectionError>
      </PageSection>
    );
  }

  if (!reviewsAndTastings?.results.length) return null;

  return (
    <PageSection
      heading="Recent activity"
      intro={
        <TextLink href={`${getEntityUrl(entity)}/tastings`}>
          View all activity
        </TextLink>
      }
    >
      <CommunityFeed
        ariaLabel={`Recent ${entity.name} activity`}
        items={getReviewAndTastingFeedItems(reviewsAndTastings.results)}
        limit={3}
      />
    </PageSection>
  );
}
