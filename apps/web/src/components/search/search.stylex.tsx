"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import type {
  SearchResultGroup,
  SearchResultItem,
} from "@peated/web/components";
import { Button, SearchBox } from "@peated/web/components";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import useAuth from "@peated/web/hooks/useAuth";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  addRecentSearch,
  readRecentSearches,
  writeRecentSearches,
} from "@peated/web/lib/recentSearches";
import { getEntityUrl } from "@peated/web/lib/urls";
import * as stylex from "@stylexjs/stylex";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDebounceCallback } from "usehooks-ts";

import { space } from "../../styles/tokens.stylex";

const searchScopes = [
  { label: "Everything", value: "all" },
  { label: "Bottles", value: "bottles" },
  { label: "Distillers", value: "distilleries" },
  { label: "Brands", value: "brands" },
  { label: "Bottlers", value: "bottlers" },
  { label: "Members", value: "members" },
] as const;

const allApiScopes = [
  "bottles",
  "distilleries",
  "brands",
  "bottlers",
  "companies",
  "regions",
  "members",
] as const;

type SearchResponse = Outputs["search"];
type SearchGroup = SearchResponse["groups"][number];
type SearchExact = NonNullable<SearchResponse["exact"]>;
type SearchNearest = SearchResponse["nearest"][number];
type BottleSearchResult = Extract<
  SearchGroup,
  { type: "bottles" }
>["results"][number];
type EntitySearchResult = Extract<
  SearchGroup,
  { type: "distilleries" }
>["results"][number];
type RegionSearchResult = Extract<
  SearchGroup,
  { type: "regions" }
>["results"][number];
type MemberSearchResult = Extract<
  SearchGroup,
  { type: "members" }
>["results"][number];
export type SearchScope = (typeof searchScopes)[number]["value"];

type SearchSnapshot = {
  count: number;
  emptyText?: string;
  groups: SearchResultGroup[];
  hasExact: boolean;
  query: string;
  scope: SearchScope;
  scopeCounts: Record<SearchScope, number>;
  scopeTotals: SearchResponse["scopeTotals"];
};

export type SearchProps = {
  autoFocus?: boolean;
  browseHeader?: ReactNode;
  contributionLabel?: string;
  defaultOpen?: boolean;
  getBottleHref?: (bottleId: number) => string;
  getContributionHref?: (query: string) => string;
  initialQuery?: string;
  initialScope?: SearchScope;
  limit?: number;
  onScopeChange?: (scope: SearchScope, query: string) => void;
  onSubmit?: (query: string) => void;
  placement?: "database" | "overlay" | "page";
  placeholder?: string;
  scopeValues?: readonly SearchScope[];
  showBottleRatings?: boolean;
  submitLabel?: string;
};

const SEARCH_DEBOUNCE_MS = 140;
const SEARCH_INDICATOR_FLOOR_MS = 250;

function getDefaultBottleHref(bottleId: number) {
  return `/bottles/${bottleId}`;
}

function getDefaultContributionHref(query: string) {
  return getCreateBottleHref({ query });
}

function recentSearchGroups(searches: readonly string[]): SearchResultGroup[] {
  if (!searches.length) return [];
  return [
    {
      id: "recent-searches",
      items: searches.map((query) => ({
        href: `/search?q=${encodeURIComponent(query)}`,
        id: `recent-search-${query.toLocaleLowerCase()}`,
        title: query,
      })),
      label: "Recent searches",
    },
  ];
}

function waitForSearchIndicator() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, SEARCH_INDICATOR_FLOOR_MS);
  });
}

function isSearchScope(value: string): value is SearchScope {
  return searchScopes.some((scope) => scope.value === value);
}

function getApiScopes(scope: SearchScope, signedIn: boolean) {
  if (scope !== "all") return [scope];
  return allApiScopes.filter((value) => signedIn || value !== "members");
}

function getSearchingText(scope: SearchScope, signedIn: boolean) {
  if (scope === "all") {
    return signedIn
      ? "Searching bottles, distillers, brands, bottlers, and members…"
      : "Searching bottles, distillers, brands, and bottlers…";
  }
  const label = searchScopes.find((option) => option.value === scope)?.label;
  return label ? `Searching ${label.toLocaleLowerCase()}…` : "Searching…";
}

function bottleItem(
  bottle: BottleSearchResult,
  {
    getBottleHref,
    showRatings,
  }: {
    getBottleHref: (bottleId: number) => string;
    showRatings: boolean;
  },
) {
  return {
    href: getBottleHref(bottle.id),
    id: `bottle-${bottle.id}`,
    ratings: showRatings
      ? {
          score:
            bottle.medianScore === null || bottle.scoreCount === 0
              ? undefined
              : { count: bottle.scoreCount, value: bottle.medianScore },
          bands: bottle.tastingBandCounts,
        }
      : undefined,
    metadata: getBottleMetadata(bottle),
    title: formatBottleDisplayName(bottle),
    visual: {
      fallback: "B",
      imageUrl: bottle.imageUrl,
      label: `${formatBottleDisplayName(bottle)} bottle`,
    },
  } satisfies SearchResultItem;
}

function entityItem(entity: EntitySearchResult) {
  return {
    href: getEntityUrl(entity),
    id: `entity-${entity.id}`,
    isFollowing: entity.isFollowing,
    metadata: entity.region?.name,
    title: entity.name,
    visual: {
      fallback: entity.name.slice(0, 1).toLocaleUpperCase(),
      label: entity.name,
    },
  } satisfies SearchResultItem;
}

function memberItem({ member, totalTastings }: MemberSearchResult) {
  return {
    href: `/users/${member.username}`,
    id: `member-${member.id}`,
    metadata: `${totalTastings.toLocaleString("en-US")} ${totalTastings === 1 ? "tasting" : "tastings"}`,
    title: member.username,
    visual: {
      fallback: member.username.slice(0, 1).toLocaleUpperCase(),
      imageUrl: member.pictureUrl,
      label: `${member.username}'s profile`,
    },
  } satisfies SearchResultItem;
}

function regionItem(region: RegionSearchResult) {
  return {
    href: `/locations/${region.country.slug}/regions/${region.slug}`,
    id: `region-${region.id}`,
    metadata: `${region.country.name} · ${region.totalDistillers.toLocaleString("en-US")} ${region.totalDistillers === 1 ? "distillery" : "distilleries"}`,
    title: region.name,
    visual: {
      fallback: region.name.slice(0, 1).toLocaleUpperCase(),
      label: region.name,
    },
  } satisfies SearchResultItem;
}

function getGroupLabel(type: SearchGroup["type"]) {
  switch (type) {
    case "bottles":
      return "Bottles";
    case "distilleries":
      return "Distillers";
    case "brands":
      return "Brands";
    case "bottlers":
      return "Bottlers";
    case "companies":
      return "Companies";
    case "regions":
      return "Regions";
    case "members":
      return "Members";
  }
}

function getMoreHref(query: string, type: SearchGroup["type"]) {
  const encodedQuery = encodeURIComponent(query);
  if (type === "members") {
    return `/search?q=${encodedQuery}&type=users`;
  }
  return searchScopes.some((option) => option.value === type)
    ? `/search?q=${encodedQuery}&type=${type}`
    : `/search?q=${encodedQuery}`;
}

type BottleItemOptions = Parameters<typeof bottleItem>[1];

function groupItems(
  group: SearchGroup,
  bottleOptions: BottleItemOptions,
): SearchResultItem[] {
  switch (group.type) {
    case "bottles":
      return group.results.map((bottle) => bottleItem(bottle, bottleOptions));
    case "distilleries":
    case "brands":
    case "bottlers":
    case "companies":
      return group.results.map(entityItem);
    case "regions":
      return group.results.map(regionItem);
    case "members":
      return group.results.map(memberItem);
  }
}

function resultGroups(
  response: SearchResponse,
  query: string,
  bottleOptions: BottleItemOptions,
  showMoreLinks: boolean,
  scope: SearchScope,
): SearchResultGroup[] {
  if (response.exact && exactMatchesScope(response.exact, scope)) {
    return [
      {
        id: "exact",
        items: [exactItem(response.exact, bottleOptions)],
        label: "Exact match",
        total: 1,
      },
    ];
  }

  const groups = response.groups.flatMap((group): SearchResultGroup[] => {
    if (!groupMatchesScope(group.type, scope)) return [];
    const items = groupItems(group, bottleOptions);
    if (!items.length) return [];
    return [
      {
        id: group.type,
        items,
        label: getGroupLabel(group.type),
        moreHref:
          showMoreLinks && group.total > items.length
            ? getMoreHref(query, group.type)
            : undefined,
        total: group.total,
      },
    ];
  });

  if (!groups.length && response.nearest.length) {
    groups.push({
      id: "nearest",
      items: response.nearest
        .filter((nearest) => groupMatchesScope(nearest.type, scope))
        .map((nearest) => nearestItem(nearest, bottleOptions)),
      label: "Did you mean?",
    });
  }
  return groups.filter((group) => group.items.length > 0);
}

function groupMatchesScope(type: SearchGroup["type"], scope: SearchScope) {
  return scope === "all" || type === scope;
}

function exactMatchesScope(exact: SearchExact, scope: SearchScope) {
  if (scope === "all") return true;
  if (exact.type === "bottle") return scope === "bottles";
  return (
    (exact.ref.kind === "distillery" && scope === "distilleries") ||
    (exact.ref.kind === "brand" && scope === "brands") ||
    (exact.ref.kind === "bottler" && scope === "bottlers")
  );
}

function getResultCount(response: SearchResponse, scope: SearchScope) {
  if (response.exact && exactMatchesScope(response.exact, scope)) return 1;
  return response.groups.reduce(
    (total, group) =>
      total + (groupMatchesScope(group.type, scope) ? group.total : 0),
    0,
  );
}

function getResultScopeTotals(response: SearchResponse) {
  return {
    all: getResultCount(response, "all"),
    bottles: getResultCount(response, "bottles"),
    distilleries: getResultCount(response, "distilleries"),
    brands: getResultCount(response, "brands"),
    bottlers: getResultCount(response, "bottlers"),
    members: getResultCount(response, "members"),
  } satisfies Record<SearchScope, number>;
}

function exactItem(exact: SearchExact, bottleOptions: BottleItemOptions) {
  return exact.type === "bottle"
    ? bottleItem(exact.ref, bottleOptions)
    : entityItem(exact.ref);
}

function nearestItem(nearest: SearchNearest, bottleOptions: BottleItemOptions) {
  switch (nearest.type) {
    case "bottles":
      return bottleItem(nearest.result, bottleOptions);
    case "distilleries":
    case "brands":
    case "bottlers":
    case "companies":
      return entityItem(nearest.result);
    case "regions":
      return regionItem(nearest.result);
    case "members":
      return memberItem(nearest.result);
  }
}

function getScopeCount(
  scope: SearchScope,
  totals: SearchResponse["scopeTotals"] | undefined,
) {
  if (!totals) return undefined;
  if (scope !== "all") return totals[scope];
  return Object.values(totals).reduce<number>(
    (total, count) => total + (count ?? 0),
    0,
  );
}

export function Search({
  autoFocus = false,
  browseHeader,
  contributionLabel = "Add a new bottle",
  defaultOpen = false,
  getBottleHref = getDefaultBottleHref,
  getContributionHref = getDefaultContributionHref,
  initialQuery = "",
  initialScope = "all",
  limit = 3,
  onScopeChange,
  onSubmit,
  placement = "overlay",
  placeholder = "bottles, distillers, brands…",
  scopeValues,
  showBottleRatings = true,
  submitLabel,
}: SearchProps = {}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [snapshot, setSnapshot] = useState<SearchSnapshot>();
  const [status, setStatus] = useState<"error" | "ready" | "searching">(
    initialQuery.trim() ? "searching" : "ready",
  );
  const latestRequest = useRef(0);
  const initialSearchStarted = useRef(false);
  const previousInitialQuery = useRef(initialQuery);
  const previousInitialScope = useRef(initialScope);
  const availableScopeDefinitions = scopeValues
    ? searchScopes.filter((option) => scopeValues.includes(option.value))
    : user
      ? searchScopes
      : searchScopes.filter((option) => option.value !== "members");
  const effectiveScope = availableScopeDefinitions.some(
    (option) => option.value === scope,
  )
    ? scope
    : (availableScopeDefinitions[0]?.value ?? "all");
  // Result metadata belongs only to the query and scope that produced it.
  const currentSnapshot =
    snapshot?.query === query.trim() && snapshot.scope === effectiveScope
      ? snapshot
      : undefined;
  const availableScopes = availableScopeDefinitions.map((option) => ({
    ...option,
    count: getScopeCount(option.value, currentSnapshot?.scopeTotals),
  }));
  const availableScopeFacets = currentSnapshot
    ? availableScopeDefinitions.map((option) => ({
        ...option,
        count: currentSnapshot.scopeCounts[option.value],
      }))
    : undefined;

  const runSearch = useCallback(
    async (nextQuery: string, nextScope: SearchScope) => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;
      const trimmedQuery = nextQuery.trim();
      if (!trimmedQuery) {
        setSnapshot(undefined);
        setStatus("ready");
        return;
      }

      setStatus("searching");
      const indicatorFloor = waitForSearchIndicator();
      try {
        const [response] = await Promise.all([
          orpc.search.call({
            limit: placement === "database" && nextScope !== "all" ? 50 : limit,
            query: trimmedQuery,
            scopes: [
              ...getApiScopes(
                placement === "database" ? "all" : nextScope,
                Boolean(user),
              ),
            ],
          }),
          indicatorFloor,
        ]);
        if (latestRequest.current !== requestId) return;
        const nextGroups = resultGroups(
          response,
          trimmedQuery,
          { getBottleHref, showRatings: showBottleRatings },
          placement === "database" || placement === "overlay",
          nextScope,
        );
        const nextResultCount = getResultCount(response, nextScope);
        const hasMatches = nextResultCount > 0;
        setSnapshot({
          count: nextResultCount,
          emptyText: hasMatches
            ? undefined
            : response.nearest.length
              ? `No exact matches for “${trimmedQuery}”.`
              : `Nothing matches “${trimmedQuery}”.`,
          groups: nextGroups,
          hasExact: Boolean(
            response.exact && exactMatchesScope(response.exact, nextScope),
          ),
          query: trimmedQuery,
          scope: nextScope,
          scopeCounts: getResultScopeTotals(response),
          scopeTotals: response.scopeTotals,
        });
        setStatus("ready");
      } catch {
        await indicatorFloor;
        if (latestRequest.current !== requestId) return;
        setStatus("error");
      }
    },
    [getBottleHref, limit, orpc, placement, showBottleRatings, user],
  );
  const debouncedSearch = useDebounceCallback(runSearch, SEARCH_DEBOUNCE_MS);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  useEffect(() => {
    if (placement === "page") return;
    // Browser storage is unavailable during server rendering.
    // oxlint-disable-next-line react/set-state-in-effect
    setRecentSearches(readRecentSearches());
  }, [placement]);

  useEffect(() => {
    if (initialSearchStarted.current || !initialQuery.trim()) return;
    initialSearchStarted.current = true;
    void runSearch(initialQuery, effectiveScope);
  }, [effectiveScope, initialQuery, runSearch]);

  useEffect(() => {
    if (previousInitialQuery.current === initialQuery) return;
    previousInitialQuery.current = initialQuery;
    setQuery(initialQuery);
    debouncedSearch.cancel();
    void runSearch(initialQuery, effectiveScope);
  }, [debouncedSearch, effectiveScope, initialQuery, runSearch]);

  useEffect(() => {
    if (previousInitialScope.current === initialScope) return;
    previousInitialScope.current = initialScope;
    setScope(initialScope);
    debouncedSearch.cancel();
    void runSearch(query, initialScope);
  }, [debouncedSearch, initialScope, query, runSearch]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    // Invalidate the current request before the next debounced request starts.
    latestRequest.current += 1;
    if (!nextQuery.trim()) {
      debouncedSearch.cancel();
      setSnapshot(undefined);
      setStatus("ready");
      return;
    }
    setStatus("searching");
    void debouncedSearch(nextQuery, effectiveScope);
  }

  function submitSearch(value: string) {
    const trimmedValue = value.trim();
    rememberSearch(trimmedValue);
    if (onSubmit) {
      onSubmit(trimmedValue);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmedValue)}`);
  }

  function rememberSearch(value: string) {
    if (placement === "page") return;
    const next = addRecentSearch(readRecentSearches(), value);
    writeRecentSearches(next);
    setRecentSearches(next);
  }

  const groups = query.trim()
    ? (currentSnapshot?.groups ?? [])
    : recentSearchGroups(recentSearches);

  const searchBox = (
    <SearchBox
      autoFocus={autoFocus}
      browseHeader={browseHeader}
      contribution={
        query.trim() &&
        currentSnapshot &&
        !currentSnapshot.hasExact &&
        (effectiveScope === "all" || effectiveScope === "bottles")
          ? {
              description: `Can't find “${currentSnapshot.query}”?`,
              href: getContributionHref(currentSnapshot.query),
              label: contributionLabel,
            }
          : undefined
      }
      defaultOpen={defaultOpen || placement === "page"}
      emptyText={currentSnapshot?.emptyText}
      fluid={Boolean(submitLabel)}
      groups={groups}
      onQueryChange={updateQuery}
      onRetry={() => void runSearch(query, effectiveScope)}
      onResultSelect={(item) => {
        rememberSearch(query.trim() || item.title);
        router.push(item.href);
      }}
      onScopeChange={(nextScope) => {
        if (!isSearchScope(nextScope)) return;
        debouncedSearch.cancel();
        previousInitialScope.current = nextScope;
        setScope(nextScope);
        onScopeChange?.(nextScope, query);
        void runSearch(query, nextScope);
      }}
      onSubmit={submitSearch}
      placement={placement}
      placeholder={placeholder}
      query={query}
      resultCount={currentSnapshot?.count}
      resultQuery={snapshot?.query}
      scope={effectiveScope}
      scopeFacets={availableScopeFacets}
      scopes={availableScopes}
      status={status}
      statusText={
        status === "searching"
          ? getSearchingText(effectiveScope, Boolean(user))
          : undefined
      }
      submitLabel={submitLabel}
    />
  );

  if (!submitLabel || placement === "database") return searchBox;

  return (
    <div {...stylex.props(styles.searchWithSubmit)}>
      <div {...stylex.props(styles.searchControl)}>{searchBox}</div>
      <Button
        disabled={!query.trim()}
        onClick={() => submitSearch(query)}
        size="md"
        variant="accent"
      >
        {submitLabel}
      </Button>
    </div>
  );
}

const styles = stylex.create({
  searchWithSubmit: {
    display: "flex",
    width: "100%",
    alignItems: "flex-start",
    gap: space.x2,
  },
  searchControl: {
    minWidth: 0,
    flex: 1,
  },
});
