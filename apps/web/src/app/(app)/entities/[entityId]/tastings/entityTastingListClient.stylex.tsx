"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import { ButtonLink } from "@peated/web/components/button.stylex";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import { EmptyState } from "@peated/web/components/feedback.stylex";
import { CursorPager } from "@peated/web/components/lists.stylex";
import { getReviewAndTastingFeedItems } from "@peated/web/lib/communityFeed";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../../styles/tokens.stylex";

type ReviewsAndTastings = Outputs["activity"]["reviewsAndTastings"];

export function EntityTastingListClient({
  entityId,
  entityName,
  initialActivity,
}: {
  entityId: number;
  entityName: string;
  initialActivity: ReviewsAndTastings;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cursor = searchParams.get("cursor") ?? undefined;
  const { data: activity } = useSuspenseQuery({
    ...orpc.activity.reviewsAndTastings.queryOptions({
      input: { cursor, entity: entityId, limit: 25 },
    }),
    initialData: initialActivity,
  });

  return (
    <section
      aria-label={`Reviews and tastings of ${entityName}`}
      {...stylex.props(styles.content)}
    >
      {activity.results.length ? (
        <CommunityFeed
          ariaLabel={`${entityName} reviews and tastings`}
          items={getReviewAndTastingFeedItems(activity.results)}
        />
      ) : (
        <EmptyState
          action={
            <ButtonLink
              href="/addBottle?intent=tasting"
              size="sm"
              variant="accent"
            >
              Find a bottle
            </ButtonLink>
          }
          heading="No reviews or tastings yet"
        >
          No one has published a review or logged a tasting connected to{" "}
          {entityName} yet.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel={`${entityName} review and tasting pages`}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          activity.rel.nextCursor,
        )}
      />
    </section>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
});
