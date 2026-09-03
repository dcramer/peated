"use client";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ButtonLink, LoadingList, SectionError } from "@peated/web/components";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import {
  HomeActivityFeed,
  HomeContributionPrompt,
  HomeDistilleries,
  HomeLatestReleases,
  HomeOrigins,
} from "@peated/web/components/pages/homeBrowse.stylex";
import { HomePage } from "@peated/web/components/pages/homePage.stylex";
import { HomeSectionLoading } from "@peated/web/components/pages/homeSummary.stylex";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { Search } from "@peated/web/components/search/search.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getCommunityFeedItems } from "@peated/web/lib/communityFeed";
import { isEventWithinDays } from "@peated/web/lib/eventDates";
import { getRegionMap } from "@peated/web/lib/locationMap";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  memberHomeQueries,
  publicHomeQueries,
} from "@peated/web/lib/orpc/homeQueries";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";
import { HomeEventCallout } from "./homeEventCallout.stylex";

export function PublicHome({
  searchPlaceholder,
}: {
  searchPlaceholder: string;
}) {
  const orpc = useORPC();
  const router = useRouter();
  const { user } = useAuth();
  const stats = useQuery(publicHomeQueries.stats(orpc));
  const events = useQuery(publicHomeQueries.events(orpc));
  const nextEvent = events.data?.results[0];
  const upcomingEvent =
    nextEvent && isEventWithinDays(nextEvent, 30) ? nextEvent : null;

  return (
    <HomePage
      content={
        <PageColumns
          rail={
            <>
              {upcomingEvent ? (
                <div {...stylex.props(styles.desktopOnly)}>
                  <HomeEventCallout
                    event={upcomingEvent}
                    headingId="upcoming-event-desktop"
                  />
                </div>
              ) : null}
              <div {...stylex.props(styles.secondaryRail)}>
                <Distilleries totalDistilleries={stats.data?.distilleries} />
                <HomeContributionPrompt
                  primaryAction={
                    <ButtonLink
                      href={user ? "/addBottle?intent=catalog" : "/register"}
                      size="sm"
                      variant="accent"
                    >
                      {user ? "Add a bottle" : "Create an account"}
                    </ButtonLink>
                  }
                  secondaryAction={
                    <ButtonLink href="/bottles" size="sm" variant="text">
                      Or keep browsing
                    </ButtonLink>
                  }
                />
              </div>
            </>
          }
          railBehavior="stack"
        >
          <div {...stylex.props(styles.sections)}>
            {upcomingEvent ? (
              <div {...stylex.props(styles.mobileEvent)}>
                <HomeEventCallout
                  event={upcomingEvent}
                  headingId="upcoming-event-mobile"
                />
              </div>
            ) : null}
            <LatestReleases />
            <Activity />
            <div {...stylex.props(styles.desktopOnly)}>
              <Origins />
            </div>
          </div>
        </PageColumns>
      }
      description="Browse whisky bottles, including single casks, with critic scores and tasting notes. No account needed."
      search={
        <Search
          onSubmit={(query) =>
            router.push(
              query ? `/search?q=${encodeURIComponent(query)}` : "/search",
            )
          }
          placeholder={searchPlaceholder}
          scopeValues={["all"]}
          showBottleRatings={false}
          submitLabel="Search"
        />
      }
      title="A record of whisky, bottle by bottle."
    />
  );
}

function LatestReleases() {
  const orpc = useORPC();
  const { user } = useAuth();
  const globalReleases = useQuery(publicHomeQueries.releases(orpc));
  const followedReleases = useQuery({
    ...memberHomeQueries.followedReleases(orpc),
    enabled: Boolean(user),
  });
  const useFollowedReleases = Boolean(
    user && followedReleases.data?.results.length,
  );
  const releases = useFollowedReleases
    ? followedReleases.data
    : globalReleases.data;

  if (
    !useFollowedReleases &&
    (globalReleases.isPending || (Boolean(user) && followedReleases.isPending))
  ) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading recent releases" rows={4} />
      </HomeSectionLoading>
    );
  }

  if (!releases) {
    return (
      <SectionError
        heading="Recent releases are unavailable"
        onRetry={() => {
          void globalReleases.refetch();
          if (user) void followedReleases.refetch();
        }}
      >
        We couldn't load the recent releases. The rest of the database is still
        available.
      </SectionError>
    );
  }

  const items = releases.results.flatMap((bottle) => {
    if (bottle.releaseYear === null) return [];

    return [toBottleListItem(bottle)];
  });

  return items.length ? (
    <HomeLatestReleases
      bottles={items}
      seeAllHref={
        useFollowedReleases
          ? "/bottles?filter=following&sort=-release"
          : "/bottles?sort=-release"
      }
      title={useFollowedReleases ? "New for you" : "Recent releases"}
    />
  ) : null;
}

function Activity() {
  const orpc = useORPC();
  const externalReviews = useQuery(publicHomeQueries.recentReviews(orpc));
  const tastings = useQuery(publicHomeQueries.memberTastings(orpc));

  if (tastings.isPending && externalReviews.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading activity" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (tastings.error && externalReviews.error) {
    return (
      <SectionError
        heading="Activity is unavailable"
        onRetry={() => {
          void tastings.refetch();
          void externalReviews.refetch();
        }}
      >
        We couldn't load the latest tastings and reviews. The rest of the
        database is still available.
      </SectionError>
    );
  }

  const memberTastings = tastings.data?.results ?? [];
  const criticReviews = externalReviews.data?.results ?? [];
  const items = getCommunityFeedItems({ criticReviews, memberTastings });

  return items.length ? (
    <HomeActivityFeed>
      <CommunityFeed
        ariaLabel="Recent tastings and reviews"
        items={items}
        limit={3}
      />
    </HomeActivityFeed>
  ) : null;
}

function Origins() {
  const orpc = useORPC();
  const countries = useQuery(publicHomeQueries.countries(orpc));
  const regions = useQuery(publicHomeQueries.regions(orpc));

  if (countries.isPending || regions.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading whisky origins" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (countries.error && regions.error) {
    return (
      <SectionError
        heading="Origins are unavailable"
        onRetry={() => {
          void countries.refetch();
          void regions.refetch();
        }}
      >
        We couldn't load the origin guide. Bottle search and the other homepage
        sections still work.
      </SectionError>
    );
  }

  const countryItems = countries.data?.results ?? [];
  const regionItems = regions.data?.results ?? [];
  const featuredCountries = countryItems.slice(0, 3);
  const remainingCountries = countryItems.slice(3);

  return countryItems.length || regionItems.length ? (
    <HomeOrigins
      countries={featuredCountries.map((country) => ({
        href: `/locations/${country.slug}`,
        name: country.name,
        totalBottles: country.totalBottles,
        visual: { kind: "country" as const, slug: country.slug },
      }))}
      regions={regionItems.slice(0, 4).map((region) => ({
        description: region.description ?? undefined,
        href: `/locations/${region.country.slug}/regions/${region.slug}`,
        name: region.name,
        totalBottles: region.totalBottles,
        visual: getRegionMap(region.country.slug, region.slug),
      }))}
      remainingCountries={
        remainingCountries.length
          ? {
              count: remainingCountries.length,
              totalBottles: remainingCountries.reduce(
                (total, country) => total + country.totalBottles,
                0,
              ),
            }
          : undefined
      }
    />
  ) : null;
}

function Distilleries({ totalDistilleries }: { totalDistilleries?: number }) {
  const orpc = useORPC();
  const distilleries = useQuery(publicHomeQueries.distilleries(orpc));

  if (distilleries.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading distilleries" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (distilleries.error) {
    return (
      <SectionError
        heading="Distilleries are unavailable"
        onRetry={() => void distilleries.refetch()}
      >
        We couldn't load the distilleries with the most bottles. The other
        homepage sections still work.
      </SectionError>
    );
  }

  return distilleries.data.results.length ? (
    <HomeDistilleries
      distilleries={distilleries.data.results.map((distillery) => ({
        href: getEntityUrl(distillery),
        location: [distillery.region?.name, distillery.country?.name]
          .filter(Boolean)
          .join(", "),
        name: distillery.name,
        totalBottles: distillery.totalBottles,
      }))}
      totalDistilleries={totalDistilleries}
    />
  ) : null;
}

const NARROW = "@media (max-width: 759px)";

const styles = stylex.create({
  desktopOnly: {
    display: "block",
    [NARROW]: {
      display: "none",
    },
  },
  mobileEvent: {
    display: "none",
    [NARROW]: {
      display: "block",
    },
  },
  secondaryRail: {
    display: "flex",
    flexDirection: "column",
    gap: space.x12,
  },
  sections: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x12,
  },
});
