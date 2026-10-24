"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { ButtonLink } from "@peated/web/components/button.stylex";
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
  getProfileTastingInput,
  getProfileTastingView,
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
  "cursor",
  "distiller",
  "entity",
  "query",
  "rating",
  "region",
];

export function ProfileTastingsPageClient() {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isCurrentUser, user } = useProfile();
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
  const input = getProfileTastingInput(searchParams, user.id);
  const displayed = new URLSearchParams(displayedParams);
  const displayedInput = getProfileTastingInput(displayed, user.id);
  const view = getProfileTastingView(displayed);
  const tastingQuery = useQuery(profileQueries.tastings(orpc, input));
  const statsQuery = useQuery(profileQueries.tastingStats(orpc, user.id));
  const regionQuery = useQuery(profileQueries.regions(orpc, user.id));
  const { entity } = displayedInput;
  const entityQuery = useQuery({
    ...orpc.entities.details.queryOptions({ input: { entity: entity ?? 0 } }),
    enabled: entity !== undefined,
  });
  const activeFilterCount = FILTER_PARAMS.filter(
    (name) => name !== "cursor" && displayed.get(name),
  ).length;
  const hasFilters = activeFilterCount > 0;
  const filters = getFilterGroups({
    entity:
      entity === undefined
        ? undefined
        : { id: entity, name: entityQuery.data?.name },
    params: displayed,
    regions: regionQuery.data,
    stats: statsQuery.data,
  });

  function navigate(next: URLSearchParams) {
    const nextQuery = next.toString();
    startTransition(() => {
      // Tasting queries follow the committed URL; only controls anticipate navigation.
      setDisplayedParams(nextQuery);
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    });
  }

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(displayedParams);
    if (name !== "view") next.delete("cursor");
    // A region belongs to one country, so changing the country clears it.
    if (name === "country") next.delete("region");
    if (value) next.set(name, value);
    else next.delete(name);
    navigate(next);
  }

  function selectEntity(entityId: number) {
    // One Entity filter replaces the search text it came from.
    const next = new URLSearchParams(displayedParams);
    ["cursor", "query"].forEach((name) => next.delete(name));
    next.set("entity", String(entityId));
    navigate(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(displayedParams);
    FILTER_PARAMS.forEach((name) => next.delete(name));
    navigate(next);
  }

  const search = (
    <ProfileBottleSearch
      onEntitySelect={selectEntity}
      onSubmit={(value) => setParam("query", value)}
      query={displayedInput.query}
      scope="tastings"
      userId={user.id}
    />
  );
  const groupProps = {
    groups: filters,
    onChange: setParam,
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
          ) : !results.length ? (
            hasFilters ? (
              <EmptyState heading="No matching tastings">
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
  entity,
  params,
  regions,
  stats,
}: {
  entity?: { id: number; name?: string };
  params: URLSearchParams;
  regions?: RegionList;
  stats?: TastingStats;
}): MemberListFilterGroup[] {
  const selected = (name: string, value: string) => params.get(name) === value;
  const country = params.get("country");
  const distillers = stats?.producers.distillers ?? [];
  const groups: MemberListFilterGroup[] = [];

  // A brand or producer picked from search matches any role it has.
  if (entity) {
    groups.push({
      filters: [
        {
          label: entity.name ?? "Loading…",
          selected: true,
          value: String(entity.id),
        },
      ],
      label: "Brand or producer",
      name: "entity",
    });
  }

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
    const { age } = stats;
    groups.push({
      filters: age.buckets.map((bucket) => ({
        count: bucket.count,
        label: bucket.id === "unstated" ? "No age stated" : bucket.label,
        selected: selected("age", bucket.id),
        value: bucket.id,
      })),
      label: "Age",
      name: "age",
      summary:
        age.median !== null && age.oldest !== null
          ? `Median ${formatYears(age.median)} · oldest ${formatYears(age.oldest)}`
          : undefined,
    });
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
    groups.push({
      filters: distillers.map((item) => ({
        count: item.count,
        label: item.name,
        selected: selected("distiller", String(item.id)),
        value: String(item.id),
      })),
      label: "Distilleries",
      name: "distiller",
    });
  }

  return groups;
}

function formatYears(value: number) {
  return `${value.toLocaleString("en-US")} ${value === 1 ? "year" : "years"}`;
}
