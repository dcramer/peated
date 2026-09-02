"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ButtonLink,
  CursorPager,
  EmptyState,
  ItemList,
  ItemListItem,
  LoadingList,
  RailList,
  RailListItem,
  SectionError,
} from "@peated/web/components";
import { RailSection } from "@peated/web/components/pages/pageLayout.stylex";
import { TastingRecordEntry } from "@peated/web/components/tastingRecordEntry";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useProfile } from "../profileContext";
import { getProfileTastingCursor, profileQueries } from "../profileQueries";
import { ProfileTastingsLayout } from "./profileTastingsLayout";

type RegionList = Outputs["users"]["regionList"];

export function ProfileTastingsPageClient() {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isCurrentUser, user } = useProfile();
  const cursor = getProfileTastingCursor(searchParams);
  const regionQuery = useQuery(profileQueries.regions(orpc, user.id));
  const tastingQuery = useQuery(profileQueries.tastings(orpc, user.id, cursor));

  return (
    <ProfileTastingsLayout
      rail={getRegionRail(regionQuery, user.username, isCurrentUser)}
    >
      <section aria-label={`${user.username}'s tastings`}>
        {tastingQuery.isPending ? (
          <LoadingList label="Loading member tastings" rows={4} />
        ) : tastingQuery.error ? (
          <SectionError
            heading="Tastings are unavailable"
            onRetry={() => void tastingQuery.refetch()}
          >
            The profile is still available. Try loading{" "}
            {isCurrentUser ? "your" : "their"} tastings again.
          </SectionError>
        ) : tastingQuery.data.results.length ? (
          <ItemList ariaLabel={`${user.username}'s tasting records`}>
            {tastingQuery.data.results.map((tasting) => (
              <ItemListItem key={tasting.id}>
                <TastingRecordEntry showAvatar={false} tasting={tasting} />
              </ItemListItem>
            ))}
          </ItemList>
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
              : `${user.username} has not logged a tasting yet.`}
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
    </ProfileTastingsLayout>
  );
}

function getRegionRail(
  query: ReturnType<typeof useQuery<RegionList>>,
  username: string,
  isCurrentUser: boolean,
) {
  const heading = isCurrentUser ? "What you pour" : "What they pour";
  if (query.isPending) {
    return (
      <RailSection heading={heading}>
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
    <RailSection heading={heading}>
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
