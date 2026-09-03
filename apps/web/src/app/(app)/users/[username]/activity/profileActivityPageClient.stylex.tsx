"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  CursorPager,
  EmptyState,
  LoadingList,
  SectionError,
} from "@peated/web/components";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import { getCommunityFeedItems } from "@peated/web/lib/communityFeed";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useProfile } from "../profileContext";
import {
  getProfileActivityRouteState,
  profileQueries,
} from "../profileQueries";
import { ProfileActivityLayout } from "./profileActivityLayout";

export function ProfileActivityPageClient() {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isCurrentUser, user } = useProfile();
  const { cursor, page } = getProfileActivityRouteState(searchParams);
  const activityQuery = useInfiniteQuery(
    profileQueries.activity(orpc, user.id, cursor),
  );
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch,
  } = activityQuery;
  const visibleActivity = getCommunityFeedItems({
    activity: data?.pages.flatMap((activityPage) => activityPage.results) ?? [],
    criticReviews: [],
  }).slice(0, 10);
  const firstPage = data?.pages[0];
  const lastPage = data?.pages.at(-1);

  useEffect(() => {
    if (visibleActivity.length < 10 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, visibleActivity.length]);

  return (
    <ProfileActivityLayout>
      {isPending ||
      (!visibleActivity.length && (hasNextPage || isFetchingNextPage)) ? (
        <LoadingList label="Loading member activity" rows={4} />
      ) : error ? (
        <SectionError
          heading="Activity is unavailable"
          onRetry={() => void refetch()}
        >
          The member profile is still available. Try loading activity again.
        </SectionError>
      ) : (
        <>
          {visibleActivity.length ? (
            <CommunityFeed
              ariaLabel="Member activity"
              items={visibleActivity}
            />
          ) : (
            <EmptyState heading="No activity yet">
              {isCurrentUser
                ? "Your tastings, reviews, and library additions will appear here."
                : `${user.username} has no recent activity.`}
            </EmptyState>
          )}
          <CursorPager
            ariaLabel={`${user.username} activity pages`}
            nextHref={getCursorHref(
              pathname,
              searchParams,
              lastPage?.rel.nextCursor,
              { page: page + 1 },
            )}
            page={page}
            previousHref={getCursorHref(
              pathname,
              searchParams,
              firstPage?.rel.prevCursor,
              { page: Math.max(1, page - 1) },
            )}
          />
        </>
      )}
    </ProfileActivityLayout>
  );
}
