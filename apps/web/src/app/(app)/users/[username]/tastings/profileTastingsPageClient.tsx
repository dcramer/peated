"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";

import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import {
  EmptyState,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import { ListControls } from "@peated/web/components/listControls.stylex";
import { CursorPager, ListToolbar } from "@peated/web/components/lists.stylex";
import {
  MemberListFilterGroups,
  MemberListFilters,
  type MemberListFilterGroup,
} from "@peated/web/components/pages/memberListFilters.stylex";
import { RATING_BANDS } from "@peated/web/components/scoring.stylex";
import { TastingTable } from "@peated/web/components/tastingTable.stylex";
import { getTastingFeedItems } from "@peated/web/lib/communityFeed";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getTastingTableItems } from "@peated/web/lib/tastingTable";
import { ProfileBottleSearch } from "../profileBottleSearch.stylex";
import { useProfile } from "../profileContext";
import {
  getAgeFilterGroup,
  getEntityCountGroup,
  useEntityFilterGroup,
  useProfileListParams,
} from "../profileListFilters";
import {
  getProfileListView,
  getProfileTastingInput,
  profileQueries,
} from "../profileQueries";
import {
  ProfileTastingsFiltersLoading,
  ProfileTastingsLayout,
  ProfileTastingsResultsLoading,
} from "./profileTastingsLayout";

type RegionList = Outputs["users"]["regionList"];
type TastingStats = Outputs["users"]["tastingStats"];

const sortOptions = [
  { label: "Newest", value: "-created" },
  { label: "Best rated", value: "-rating" },
  { label: "Bottle name", value: "name" },
] as const;

// Filters a member can clear at once; `sort` and `view` are display choices.
const FILTER_PARAMS = [
  "age",
  "country",
  "distiller",
  "entity",
  "query",
  "rating",
  "region",
];

export function ProfileTastingsPageClient() {
  const orpc = useORPC();
  const { isCurrentUser, user } = useProfile();
  const {
    activeFilterCount,
    clearFilters,
    displayed,
    isNavigating,
    pathname,
    searchParams,
    setParam,
  } = useProfileListParams(FILTER_PARAMS);
  const input = getProfileTastingInput(searchParams, user.id);
  const displayedInput = getProfileTastingInput(displayed, user.id);
  const view = getProfileListView(displayed);
  const tastingQuery = useQuery(profileQueries.tastings(orpc, input));
  const statsQuery = useQuery(profileQueries.tastingStats(orpc, user.id));
  const regionQuery = useQuery(profileQueries.regions(orpc, user.id));
  const entityGroup = useEntityFilterGroup(displayedInput.entity);
  const hasFilters = activeFilterCount > 0;
  const filters = [
    ...(entityGroup ? [entityGroup] : []),
    ...getFilterGroups({
      params: displayed,
      regions: regionQuery.data,
      stats: statsQuery.data,
    }),
  ];

  function setFilter(name: string, value: string) {
    // A region belongs to one country, so changing the country clears it.
    setParam(name, value, name === "country" ? ["region"] : []);
  }

  const search = (
    <ProfileBottleSearch
      // One brand or producer filter replaces the search text it came from.
      onEntitySelect={(entityId) =>
        setParam("entity", String(entityId), ["query"])
      }
      onSubmit={(value) => setParam("query", value)}
      query={displayedInput.query}
      scope="tastings"
      userId={user.id}
    />
  );
  const groupProps = {
    groups: filters,
    onChange: setFilter,
    total: statsQuery.data?.total,
  };
  const results = tastingQuery.data?.results ?? [];
  const pending = isNavigating || tastingQuery.isFetching;
  // Counts come from the server render; keep the rail's shape until they do.
  const filtersPending = statsQuery.isPending || regionQuery.isPending;
  const hasCountry = Boolean(displayedInput.country);

  return (
    <ProfileTastingsLayout
      rail={
        filtersPending ? (
          <ProfileTastingsFiltersLoading hasCountry={hasCountry} />
        ) : (
          <MemberListFilters
            {...groupProps}
            onClear={clearFilters}
            query={displayedInput.query}
            search={search}
          />
        )
      }
    >
      <section aria-label={`${user.username}'s tastings`}>
        {/* Without data the toolbar would read "0 tastings"; reserve it instead. */}
        {tastingQuery.isPending ? (
          <ProfileTastingsResultsLoading view={view} />
        ) : tastingQuery.data ? (
          <ListToolbar
            count={results.length}
            mobileAction={
              <ListControls
                activeFilterCount={activeFilterCount}
                filters={<MemberListFilterGroups {...groupProps} />}
                onClear={clearFilters}
                onSortChange={(value) => setParam("sort", value)}
                pluralNoun="tastings"
                search={search}
                sort={displayedInput.sort}
                sortOptions={sortOptions}
              />
            }
            mobileActionLayout="pageColumns"
            noun="tasting"
            onSortChange={(value) => setParam("sort", value)}
            onViewChange={(value) =>
              setParam("view", value === "table" ? value : "")
            }
            pending={pending}
            sort={displayedInput.sort}
            sortOptions={sortOptions}
            total={tastingQuery.data.total}
            view={view}
          />
        ) : null}
        <div aria-busy={pending || undefined}>
          {tastingQuery.isPending ? null : tastingQuery.error ? (
            <SectionError
              heading="Tastings are unavailable"
              onRetry={() => void tastingQuery.refetch()}
            >
              The profile is still available. Try loading{" "}
              {isCurrentUser ? "your" : "their"} tastings again.
            </SectionError>
          ) : !results.length && input.cursor > 1 ? (
            // A page past the end, such as after removing its last row or
            // from an old link, is not an empty list.
            <EmptyState
              action={
                <ButtonLink
                  href={getCursorHref(pathname, searchParams, 1)}
                  size="sm"
                >
                  Go to the first page
                </ButtonLink>
              }
              heading="No tastings on this page"
            >
              This page is past the end of the list.
            </EmptyState>
          ) : !results.length ? (
            hasFilters ? (
              <EmptyState
                action={
                  <Button onClick={clearFilters} size="sm" variant="text">
                    Clear filters
                  </Button>
                }
                heading="No matching tastings"
              >
                No tastings match these filters.
              </EmptyState>
            ) : (
              <EmptyState
                action={
                  isCurrentUser ? (
                    <ButtonLink
                      href="/addBottle?intent=tasting"
                      size="sm"
                      variant="accent"
                    >
                      Find a bottle
                    </ButtonLink>
                  ) : undefined
                }
                heading="No tastings yet"
              >
                {isCurrentUser
                  ? "Your tasting record will appear here."
                  : `${user.username} has not logged a tasting yet.`}
              </EmptyState>
            )
          ) : view === "table" ? (
            <TastingTable
              caption={`${user.username}'s tastings`}
              items={getTastingTableItems(results)}
            />
          ) : (
            <CommunityFeed
              ariaLabel={`${user.username}'s tastings`}
              items={getTastingFeedItems(results)}
              showActor={false}
            />
          )}
        </div>
        <CursorPager
          ariaLabel={`${user.username} tasting pages`}
          nextHref={getCursorHref(
            pathname,
            searchParams,
            tastingQuery.data?.rel.nextCursor,
          )}
          page={input.cursor}
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

function getFilterGroups({
  params,
  regions,
  stats,
}: {
  params: URLSearchParams;
  regions?: RegionList;
  stats?: TastingStats;
}): MemberListFilterGroup[] {
  const selected = (name: string, value: string) => params.get(name) === value;
  const country = params.get("country");
  const distillers = stats?.producers.distillers ?? [];
  const groups: MemberListFilterGroup[] = [];

  if (stats?.bands.total) {
    groups.push({
      filters: RATING_BANDS.toReversed().map((band) => ({
        count: stats.bands[band.key],
        label: `${band.label} · ${band.range}`,
        selected: selected("rating", band.key),
        value: band.key,
      })),
      label: "Rating",
      name: "rating",
    });
  }

  if (stats?.total) {
    groups.push(getAgeFilterGroup(stats.age, params.get("age")));
  }

  const countries = regions?.countries ?? [];
  if (countries.length) {
    groups.push({
      filters: countries
        .filter((item, index) => index < 6 || item.country.slug === country)
        .map((item) => ({
          count: item.count,
          label: item.country.name,
          selected: selected("country", item.country.slug),
          value: item.country.slug,
        })),
      label: "Countries",
      name: "country",
    });
  }

  const countryRegions = (regions?.results ?? []).filter(
    (item) => item.region && item.country.slug === country,
  );
  if (countryRegions.length) {
    groups.push({
      filters: countryRegions.map((item) => ({
        count: item.count,
        label: item.region!.name,
        selected: selected("region", item.region!.slug),
        value: item.region!.slug,
      })),
      label: "Regions",
      name: "region",
    });
  }

  if (distillers.length) {
    groups.push(
      getEntityCountGroup({
        items: distillers,
        label: "Distilleries",
        name: "distiller",
        selected: params.get("distiller"),
      }),
    );
  }

  return groups;
}
