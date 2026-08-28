"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import {
  CursorPager,
  LoadingList,
  SectionError,
  type TastingEntryMember,
} from "@peated/web/components/designSystem/components";
import {
  MemberActivityList,
  type MemberActivityItem,
} from "@peated/web/components/designSystem/patterns/memberProfileContent.stylex";
import {
  Avatar,
  PageColumns,
} from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { getBottleExpressionName } from "@peated/web/lib/bottleLabel";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useProfile } from "../profileContext";
import { getProfileBottleMetadata } from "../profilePresentation";

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
  const activityQuery = useQuery({
    ...orpc.users.activity.list.queryOptions({
      input: { cursor, limit: 10, user: user.id },
    }),
    initialData: initialActivityList,
  });

  return (
    <PageColumns>
      <section aria-label={`${user.username}'s activity`}>
        {activityQuery.isPending ? (
          <LoadingList label="Loading member activity" rows={4} />
        ) : activityQuery.error ? (
          <SectionError
            heading="Activity is unavailable"
            onRetry={() => void activityQuery.refetch()}
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
              items={activityQuery.data.results
                .filter(
                  (activity) =>
                    activity.type !== "collection_add" ||
                    !activity.collection.href?.endsWith("/favorites"),
                )
                .map(toActivityItem)}
            />
            <CursorPager
              ariaLabel={`${user.username} activity pages`}
              nextHref={getCursorHref(
                pathname,
                searchParams,
                activityQuery.data.rel.nextCursor,
                page + 1,
              )}
              page={page}
              previousHref={getCursorHref(
                pathname,
                searchParams,
                activityQuery.data.rel.prevCursor,
                Math.max(1, page - 1),
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
          metadata: getProfileBottleMetadata(entry.bottle).split(" · "),
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
  const toMember = (
    tasting: (typeof activity.tastings)[number],
  ): TastingEntryMember => ({
    description: tasting.notes,
    href: `/bottles/${tasting.bottle.id}`,
    metadata: getProfileBottleMetadata(tasting.bottle),
    name: tasting.bottle.fullName,
    notes: tasting.tags,
    ratingBand: tasting.ratingBand ?? undefined,
  });
  const members: [TastingEntryMember, ...TastingEntryMember[]] = [
    toMember(firstTasting),
    ...remainingTastings.map(toMember),
  ];
  return {
    id: activity.id,
    kind: "tasting",
    tasting: {
      author: activity.createdBy.username,
      authorHref: `/users/${activity.createdBy.username}`,
      date: <TimeSince date={activity.lastActivityAt} />,
      leading: (
        <Avatar
          imageUrl={activity.createdBy.pictureUrl}
          initials={activity.createdBy.username.slice(0, 2).toUpperCase()}
        />
      ),
      members,
    },
  };
}

function getCursorHref(
  pathname: string,
  searchParams: URLSearchParams,
  cursor: string | null,
  page: number,
) {
  if (!cursor) return undefined;
  const next = new URLSearchParams(searchParams);
  next.set("cursor", cursor);
  next.set("page", String(page));
  return `${pathname}?${next.toString()}`;
}
