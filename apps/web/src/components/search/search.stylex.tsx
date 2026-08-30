"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type {
  SearchResultGroup,
  SearchResultItem,
} from "@peated/web/components/designSystem/components";
import {
  Button,
  SearchBox,
} from "@peated/web/components/designSystem/components";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import * as stylex from "@stylexjs/stylex";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

export type SearchProps = {
  autoFocus?: boolean;
  contributionLabel?: string;
  defaultOpen?: boolean;
  getBottleHref?: (bottleId: number) => string;
  getContributionHref?: (query: string) => string;
  initialQuery?: string;
  initialScope?: SearchScope;
  limit?: number;
  onSubmit?: (query: string) => void;
  placement?: "overlay" | "page";
  placeholder?: string;
  scopeValues?: readonly SearchScope[];
  showBottleMeasures?: boolean;
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
    showMeasures,
  }: {
    getBottleHref: (bottleId: number) => string;
    showMeasures: boolean;
  },
) {
  const metadata = [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null ? null : `${bottle.abv.toFixed(1)}% ABV`,
  ].filter((value): value is string => Boolean(value));

  return {
    href: getBottleHref(bottle.id),
    id: `bottle-${bottle.id}`,
    measures: showMeasures
      ? {
          score:
            bottle.medianScore === null || bottle.scoreCount === 0
              ? undefined
              : { count: bottle.scoreCount, value: bottle.medianScore },
          bands: bottle.tastingBandCounts,
        }
      : undefined,
    metadata: metadata.join(" · "),
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
  return type === "members"
    ? `/search?q=${encodedQuery}&type=users`
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
): SearchResultGroup[] {
  if (response.exact) {
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
      items: response.nearest.map((nearest) =>
        nearestItem(nearest, bottleOptions),
      ),
      label: "Did you mean?",
    });
  }
  return groups;
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
  contributionLabel = "Add a new bottle",
  defaultOpen = false,
  getBottleHref = getDefaultBottleHref,
  getContributionHref = getDefaultContributionHref,
  initialQuery = "",
  initialScope = "all",
  limit = 3,
  onSubmit,
  placement = "overlay",
  placeholder = "bottles, distillers, brands…",
  scopeValues,
  showBottleMeasures = true,
  submitLabel,
}: SearchProps = {}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [emptyText, setEmptyText] = useState<string>();
  const [hasExactResult, setHasExactResult] = useState(false);
  const [scopeTotals, setScopeTotals] =
    useState<SearchResponse["scopeTotals"]>();
  const [settledQuery, setSettledQuery] = useState<string>();
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
  const availableScopes = availableScopeDefinitions.map((option) => ({
    ...option,
    count: getScopeCount(option.value, scopeTotals),
  }));

  const runSearch = useCallback(
    async (nextQuery: string, nextScope: SearchScope) => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;
      const trimmedQuery = nextQuery.trim();
      if (!trimmedQuery) {
        setGroups([]);
        setEmptyText(undefined);
        setHasExactResult(false);
        setSettledQuery(undefined);
        setStatus("ready");
        return;
      }

      setStatus("searching");
      const indicatorFloor = waitForSearchIndicator();
      try {
        const [response] = await Promise.all([
          orpc.search.call({
            limit,
            query: trimmedQuery,
            scopes: [...getApiScopes(nextScope, Boolean(user))],
          }),
          indicatorFloor,
        ]);
        if (latestRequest.current !== requestId) return;
        const nextGroups = resultGroups(
          response,
          trimmedQuery,
          { getBottleHref, showMeasures: showBottleMeasures },
          placement === "overlay",
        );
        const hasMatches =
          Boolean(response.exact) ||
          response.groups.some((group) => group.results.length > 0);
        setGroups(nextGroups);
        setEmptyText(
          hasMatches
            ? undefined
            : response.nearest.length
              ? `No exact records match “${trimmedQuery}”.`
              : `No records match “${trimmedQuery}”.`,
        );
        setHasExactResult(Boolean(response.exact));
        setScopeTotals(response.scopeTotals);
        setSettledQuery(trimmedQuery);
        setStatus("ready");
      } catch {
        await indicatorFloor;
        if (latestRequest.current !== requestId) return;
        setStatus("error");
      }
    },
    [getBottleHref, limit, orpc, placement, showBottleMeasures, user],
  );
  const debouncedSearch = useDebounceCallback(runSearch, SEARCH_DEBOUNCE_MS);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

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
    if (!nextQuery.trim()) {
      latestRequest.current += 1;
      debouncedSearch.cancel();
      setGroups([]);
      setEmptyText(undefined);
      setHasExactResult(false);
      setSettledQuery(undefined);
      setStatus("ready");
      return;
    }
    void debouncedSearch(nextQuery, effectiveScope);
  }

  function submitSearch(value: string) {
    const trimmedValue = value.trim();
    if (onSubmit) {
      onSubmit(trimmedValue);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmedValue)}`);
  }

  const searchBox = (
    <SearchBox
      autoFocus={autoFocus}
      contribution={
        query.trim() &&
        settledQuery &&
        !hasExactResult &&
        (effectiveScope === "all" || effectiveScope === "bottles")
          ? {
              description: `Can't find “${settledQuery}”?`,
              href: getContributionHref(settledQuery),
              label: contributionLabel,
            }
          : undefined
      }
      defaultOpen={defaultOpen || placement === "page"}
      emptyText={emptyText}
      fluid={Boolean(submitLabel)}
      groups={groups}
      onQueryChange={updateQuery}
      onRetry={() => void runSearch(query, effectiveScope)}
      onResultSelect={(item) => router.push(item.href)}
      onScopeChange={(nextScope) => {
        if (!isSearchScope(nextScope)) return;
        debouncedSearch.cancel();
        setScope(nextScope);
        void runSearch(query, nextScope);
      }}
      onSubmit={submitSearch}
      placement={placement}
      placeholder={placeholder}
      query={query}
      scope={effectiveScope}
      scopes={availableScopes}
      status={status}
      statusText={
        status === "searching"
          ? getSearchingText(effectiveScope, Boolean(user))
          : undefined
      }
    />
  );

  if (!submitLabel) return searchBox;

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
