"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ButtonLink,
  CursorPager,
  EmptyState,
  LoadingList,
  RailList,
  RailListItem,
  SectionError,
} from "@peated/web/components/designSystem/components";
import {
  PageColumns,
  RailSection,
} from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { TastingRecordEntry } from "@peated/web/components/tastingRecordEntry";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useProfile } from "./profileContext";

type TastingList = Outputs["tastings"]["list"];
type RegionList = Outputs["users"]["regionList"];

export function ProfileTastingsPageClient({
  initialRegionList,
  initialTastingList,
}: {
  initialRegionList: RegionList;
  initialTastingList: TastingList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isCurrentUser, user } = useProfile();
  const cursor = Number(searchParams.get("cursor") ?? "1") || 1;
  const regionQuery = useQuery({
    ...orpc.users.regionList.queryOptions({ input: { user: user.id } }),
    initialData: initialRegionList,
  });
  const tastingQuery = useQuery({
    ...orpc.tastings.list.queryOptions({
      input: { cursor, limit: 10, user: user.id },
    }),
    initialData: initialTastingList,
  });

  return (
    <PageColumns rail={getRegionRail(regionQuery, user.username)}>
      <section aria-label={`${user.username}'s tastings`}>
        {tastingQuery.isPending ? (
          <LoadingList label="Loading member tastings" rows={4} />
        ) : tastingQuery.error ? (
          <SectionError
            heading="Tastings are unavailable"
            onRetry={() => void tastingQuery.refetch()}
          >
            The member profile is still available. Try loading their tastings
            again.
          </SectionError>
        ) : tastingQuery.data.results.length ? (
          <div {...stylex.props(styles.tastingList)}>
            {tastingQuery.data.results.map((tasting) => (
              <TastingRecordEntry
                key={tasting.id}
                showAvatar={false}
                tasting={tasting}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              isCurrentUser ? (
                <ButtonLink
                  href="/addBottle?intent=tasting"
                  size="sm"
                  variant="accent"
                >
                  Log a tasting
                </ButtonLink>
              ) : undefined
            }
            heading="No tastings yet"
          >
            {isCurrentUser
              ? "Your tasting record will appear here."
              : `${user.username} has not recorded a tasting yet.`}
          </EmptyState>
        )}
        <CursorPager
          ariaLabel={`${user.username} tasting pages`}
          nextHref={getCursorHref(
            pathname,
            searchParams,
            tastingQuery.data?.rel.nextCursor,
          )}
          page={cursor}
          previousHref={getCursorHref(
            pathname,
            searchParams,
            tastingQuery.data?.rel.prevCursor,
          )}
        />
      </section>
    </PageColumns>
  );
}

function getRegionRail(
  query: ReturnType<typeof useQuery<RegionList>>,
  username: string,
) {
  if (query.isPending) {
    return (
      <RailSection heading="What they pour">
        <LoadingList label="Loading member regions" rows={3} />
      </RailSection>
    );
  }
  if (query.error) {
    return (
      <SectionError
        heading="Regions are unavailable"
        onRetry={() => void query.refetch()}
      >
        Try loading this part of the profile again.
      </SectionError>
    );
  }
  if (!query.data.results.length) return undefined;
  return (
    <RailSection heading="What they pour">
      <RailList ariaLabel={`${username}'s most tasted regions`}>
        {query.data.results.slice(0, 6).map((item) => (
          <RailListItem
            end={item.count.toLocaleString("en-US")}
            href={
              item.region
                ? `/locations/${item.country.slug}/regions/${item.region.slug}`
                : `/locations/${item.country.slug}`
            }
            key={`${item.country.slug}-${item.region?.slug ?? "country"}`}
            metadata={item.region ? item.country.name : undefined}
            title={item.region?.name ?? item.country.name}
          />
        ))}
      </RailList>
    </RailSection>
  );
}

const styles = stylex.create({
  tastingList: { display: "flex", minWidth: 0, flexDirection: "column" },
});
