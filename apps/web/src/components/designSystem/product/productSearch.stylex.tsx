"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type {
  SearchResultGroup,
  SearchResultItem,
} from "@peated/web/components/designSystem/components";
import { SearchExperience } from "@peated/web/components/designSystem/components";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";

const scopes = [
  { label: "Everything", value: "all" },
  { label: "Bottles", value: "bottles" },
  { label: "Distillers", value: "distillers" },
  { label: "Brands", value: "brands" },
  { label: "Bottlers", value: "bottlers" },
  { label: "Members", value: "members" },
] as const;

const allApiScopes = [
  "bottles",
  "distillers",
  "brands",
  "bottlers",
  "blenders",
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
  { type: "distillers" }
>["results"][number];
type RegionSearchResult = Extract<
  SearchGroup,
  { type: "regions" }
>["results"][number];
type MemberSearchResult = Extract<
  SearchGroup,
  { type: "members" }
>["results"][number];
type SearchScope = (typeof scopes)[number]["value"];

const SEARCH_DEBOUNCE_MS = 140;
const SEARCH_INDICATOR_FLOOR_MS = 250;

function waitForSearchIndicator() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, SEARCH_INDICATOR_FLOOR_MS);
  });
}

function isSearchScope(value: string): value is SearchScope {
  return scopes.some((scope) => scope.value === value);
}

function getApiScopes(scope: SearchScope, signedIn: boolean) {
  if (scope !== "all") return [scope];
  return allApiScopes.filter((value) => signedIn || value !== "members");
}

function getSearchingText(scope: SearchScope, signedIn: boolean) {
  if (scope === "all") {
    return signedIn
      ? "Searching bottles, entities, and members…"
      : "Searching bottles and entities…";
  }
  const label = scopes.find((option) => option.value === scope)?.label;
  return label ? `Searching ${label.toLocaleLowerCase()}…` : "Searching…";
}

function bottleItem(bottle: BottleSearchResult) {
  const metadata = [
    bottle.brand.name,
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null ? null : `${bottle.abv.toFixed(1)}% ABV`,
  ].filter((value): value is string => Boolean(value));

  return {
    href: `/bottles/${bottle.id}`,
    id: `bottle-${bottle.id}`,
    measures: {
      score:
        bottle.avgScore === null || bottle.totalScores === 0
          ? undefined
          : { count: bottle.totalScores, value: bottle.avgScore },
      verdict:
        bottle.ratingStats.total === 0
          ? undefined
          : {
              pass: bottle.ratingStats.pass,
              savor: bottle.ratingStats.savor,
              sip: bottle.ratingStats.sip,
            },
    },
    metadata: metadata.join(" · "),
    title: bottle.fullName,
    visual: {
      fallback: "B",
      imageUrl: bottle.imageUrl,
      label: `${bottle.fullName} bottle`,
    },
  } satisfies SearchResultItem;
}

function entityItem(entity: EntitySearchResult) {
  return {
    href: `/entities/${entity.id}`,
    id: `entity-${entity.id}`,
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
    case "distillers":
      return "Distillers";
    case "brands":
      return "Brands";
    case "bottlers":
      return "Bottlers";
    case "blenders":
      return "Blenders";
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

function groupItems(group: SearchGroup): SearchResultItem[] {
  switch (group.type) {
    case "bottles":
      return group.results.map(bottleItem);
    case "distillers":
    case "brands":
    case "bottlers":
    case "blenders":
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
): SearchResultGroup[] {
  if (response.exact) {
    return [
      {
        id: "exact",
        items: [exactItem(response.exact)],
        label: "Exact match",
        total: 1,
      },
    ];
  }

  const groups = response.groups.flatMap((group): SearchResultGroup[] => {
    const items = groupItems(group);
    if (!items.length) return [];
    return [
      {
        id: group.type,
        items,
        label: getGroupLabel(group.type),
        moreHref:
          group.total > items.length
            ? getMoreHref(query, group.type)
            : undefined,
        total: group.total,
      },
    ];
  });

  if (!groups.length && response.nearest.length) {
    groups.push({
      id: "nearest",
      items: response.nearest.map(nearestItem),
      label: "Did you mean?",
    });
  }
  return groups;
}

function exactItem(exact: SearchExact) {
  return exact.type === "bottle"
    ? bottleItem(exact.ref)
    : entityItem(exact.ref);
}

function nearestItem(nearest: SearchNearest) {
  switch (nearest.type) {
    case "bottles":
      return bottleItem(nearest.result);
    case "distillers":
    case "brands":
    case "bottlers":
    case "blenders":
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

export function ProductSearch() {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [emptyText, setEmptyText] = useState<string>();
  const [hasExactResult, setHasExactResult] = useState(false);
  const [scopeTotals, setScopeTotals] =
    useState<SearchResponse["scopeTotals"]>();
  const [settledQuery, setSettledQuery] = useState<string>();
  const [status, setStatus] = useState<"error" | "ready" | "searching">(
    "ready",
  );
  const latestRequest = useRef(0);
  const availableScopes = (
    user ? scopes : scopes.filter((option) => option.value !== "members")
  ).map((option) => ({
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
            limit: 3,
            query: trimmedQuery,
            scopes: [...getApiScopes(nextScope, Boolean(user))],
          }),
          indicatorFloor,
        ]);
        if (latestRequest.current !== requestId) return;
        const nextGroups = resultGroups(response, trimmedQuery);
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
    [orpc, user],
  );
  const debouncedSearch = useDebounceCallback(runSearch, SEARCH_DEBOUNCE_MS);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

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
    void debouncedSearch(nextQuery, scope);
  }

  return (
    <SearchExperience
      contribution={
        query.trim() &&
        settledQuery &&
        !hasExactResult &&
        (scope === "all" || scope === "bottles")
          ? {
              description: `Can't find “${settledQuery}”?`,
              href: getCreateBottleHref({
                query: settledQuery,
              }),
              label: "Record a bottle",
            }
          : undefined
      }
      emptyText={emptyText}
      groups={groups}
      onQueryChange={updateQuery}
      onRetry={() => void runSearch(query, scope)}
      onResultSelect={(item) => router.push(item.href)}
      onScopeChange={(nextScope) => {
        if (!isSearchScope(nextScope)) return;
        debouncedSearch.cancel();
        setScope(nextScope);
        void runSearch(query, nextScope);
      }}
      onSubmit={(value) =>
        router.push(`/search?q=${encodeURIComponent(value.trim())}`)
      }
      placeholder="bottles, distillers, brands…"
      query={query}
      scope={scope}
      scopes={availableScopes}
      status={status}
      statusText={getSearchingText(scope, Boolean(user))}
    />
  );
}
