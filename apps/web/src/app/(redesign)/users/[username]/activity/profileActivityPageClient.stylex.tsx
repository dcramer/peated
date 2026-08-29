"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  CursorPager,
  LoadingList,
  MemberAvatar,
  SectionError,
  type TastingEntryMember,
} from "@peated/web/components/designSystem/components";
import {
  MemberActivityList,
  type MemberActivityItem,
} from "@peated/web/components/designSystem/patterns/memberProfileContent.stylex";
import { PageColumns } from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { getTastingEntryMember } from "@peated/web/components/tastingRecordEntry";
import TimeSince from "@peated/web/components/timeSince";
import { getBottleExpressionName } from "@peated/web/lib/bottleLabel";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useProfile } from "../profileContext";

type Activity = Outputs["users"]["activity"]["list"]["results"][number];
type ActivityList = Outputs["users"]["activity"]["list"];

export function ProfileActivityPageClient({
  initialActivityList,
}: {
  initialActivityList: ActivityList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isCurrentUser, user } = useProfile();
  const cursor = searchParams.get("cursor") || undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;
  // Each page owns its cursor. ORPC does not expose an infinite query helper
  // for this route, so keep the query function beside the pagination rules.
  /* oxlint-disable @tanstack/query/prefer-query-options */
  const activityQuery = useInfiniteQuery<
    ActivityList,
    Error,
    InfiniteData<ActivityList>,
    QueryKey,
    string | undefined
  >({
    queryKey: orpc.users.activity.list.key({
      input: { cursor, limit: 10, user: user.id },
    }),
    queryFn: ({ pageParam }) =>
      orpc.users.activity.list.call({
        cursor: pageParam,
        limit: 10,
        user: user.id,
      }),
    initialData: { pages: [initialActivityList], pageParams: [cursor] },
    initialPageParam: cursor,
    getNextPageParam: (lastPage) => lastPage.rel.nextCursor ?? undefined,
  });
  /* oxlint-enable @tanstack/query/prefer-query-options */
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch,
  } = activityQuery;
  const visibleActivity = data.pages
    .flatMap((activityPage) => activityPage.results)
    .filter(
      (activity) =>
        activity.type !== "collection_add" ||
        !activity.collection.href?.endsWith("/favorites"),
    )
    .slice(0, 10);
  const lastPage = data.pages.at(-1) ?? initialActivityList;

  useEffect(() => {
    if (visibleActivity.length < 10 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, visibleActivity.length]);

  return (
    <PageColumns>
      <section aria-label={`${user.username}'s activity`}>
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
            <MemberActivityList
              emptyDescription={
                isCurrentUser
                  ? "Your tastings and library additions will appear here."
                  : `${user.username} has no recent activity.`
              }
              items={visibleActivity.map(toActivityItem)}
            />
            <CursorPager
              ariaLabel={`${user.username} activity pages`}
              nextHref={getCursorHref(
                pathname,
                searchParams,
                lastPage.rel.nextCursor,
                { page: page + 1 },
              )}
              page={page}
              previousHref={getCursorHref(
                pathname,
                searchParams,
                initialActivityList.rel.prevCursor,
                { page: Math.max(1, page - 1) },
              )}
            />
          </>
        )}
      </section>
    </PageColumns>
  );
}

function toActivityItem(activity: Activity): MemberActivityItem {
  if (activity.type === "collection_add") {
    return {
      activity: {
        author: activity.createdBy.username,
        authorHref: `/users/${activity.createdBy.username}`,
        collectionHref: activity.collection.href ?? undefined,
        collectionName: activity.collection.name,
        date: <TimeSince date={activity.createdAt} />,
        id: activity.id,
        items: activity.items.map((entry) => ({
          brand: entry.bottle.brand.shortName || entry.bottle.brand.name,
          brandHref: `/entities/${entry.bottle.brand.id}`,
          href: `/bottles/${entry.bottle.id}`,
          id: String(entry.id),
          imageUrl: entry.imageUrl ?? entry.bottle.imageUrl,
          metadata: getBottleMetadata(entry.bottle).split(" · "),
          name: getBottleExpressionName(entry.bottle),
        })),
        totalItems: activity.totalItems,
      },
      id: activity.id,
      kind: "collection",
    };
  }

  const [firstTasting, ...remainingTastings] = activity.tastings;
  if (!firstTasting)
    throw new Error("A tasting session must contain a tasting");
  const members: [TastingEntryMember, ...TastingEntryMember[]] = [
    getTastingEntryMember(firstTasting),
    ...remainingTastings.map(getTastingEntryMember),
  ];
  return {
    id: activity.id,
    kind: "tasting",
    tasting: {
      author: activity.createdBy.username,
      authorHref: `/users/${activity.createdBy.username}`,
      date: <TimeSince date={activity.lastActivityAt} />,
      leading: (
        <MemberAvatar
          pictureUrl={activity.createdBy.pictureUrl}
          username={activity.createdBy.username}
        />
      ),
      members,
    },
  };
}
