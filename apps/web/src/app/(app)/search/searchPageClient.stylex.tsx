"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import {
  Search,
  type SearchScope,
} from "@peated/web/components/search/search.stylex";
import {
  getAddBottleHref,
  getPendingImageFromParams,
  type AddBottleRouteIntent,
} from "@peated/web/lib/addBottle";
import { getBottleUrl } from "@peated/web/lib/urls";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, fonts, space } from "../../../styles/tokens.stylex";

type BottleUrlSource = Parameters<typeof getBottleUrl>[0];

const addBottleIntents = [
  "catalog",
  "choose",
  "library",
  "tasting",
  "view",
] as const satisfies readonly AddBottleRouteIntent[];

const databaseScopes = [
  "all",
  "bottles",
  "series",
  "distilleries",
  "brands",
  "bottlers",
  "members",
] as const satisfies readonly SearchScope[];

function getDatabaseScope(value: string | null): SearchScope {
  return databaseScopes.find((scope) => scope === value) ?? "all";
}

function BrowseHeader({ bottleTotal }: { bottleTotal: number }) {
  return (
    <header {...stylex.props(styles.browseHeader)}>
      <h1 {...stylex.props(foundationStyles.pageTitle, styles.browseTitle)}>
        Search the database
      </h1>
      <p {...stylex.props(styles.browseDescription)}>
        {bottleTotal.toLocaleString("en-US")} bottles, and someone has probably
        logged yours. Search bottles, series, distillers, brands, and bottlers.
      </p>
    </header>
  );
}

function getAddBottleIntent(value: string | null) {
  if (value === "addBottle") return "choose";
  return addBottleIntents.find((intent) => intent === value);
}

function getCreateReturnAction(
  intent: AddBottleRouteIntent | undefined,
  directToTasting: boolean,
) {
  if (
    intent === "catalog" ||
    intent === "choose" ||
    intent === "library" ||
    intent === "tasting" ||
    intent === "view"
  ) {
    return intent;
  }
  return directToTasting ? "tasting" : undefined;
}

function getTitle({
  intent,
  directToTasting,
  memberSearch,
}: {
  intent?: AddBottleRouteIntent;
  directToTasting: boolean;
  memberSearch: boolean;
}) {
  if (memberSearch) return "Find members";
  if (intent === "catalog") return "Add a bottle";
  if (intent === "library") return "Add to your Library";
  if (intent === "tasting" || directToTasting) {
    return "Log a tasting";
  }
  if (intent) return "Find a bottle";
  return "Search";
}

export function SearchPageClient({
  bottleTotal,
  initialResponse,
}: {
  bottleTotal: number;
  initialResponse?: Outputs["search"];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const intent = getAddBottleIntent(searchParams.get("intent"));
  const directToTasting = searchParams.has("tasting");
  const memberSearch = searchParams.get("type") === "users";
  const bottleSelection = Boolean(intent) || directToTasting;
  const databaseSearch = !memberSearch && !bottleSelection;
  const pendingImage = getPendingImageFromParams(searchParams);
  const initialScope: SearchScope = memberSearch
    ? "members"
    : bottleSelection
      ? "bottles"
      : getDatabaseScope(searchParams.get("type"));
  const scopeValues = memberSearch
    ? (["members"] as const)
    : bottleSelection
      ? (["bottles"] as const)
      : undefined;
  const createReturnAction = getCreateReturnAction(intent, directToTasting);

  const getBottleHref = useCallback(
    (bottle: BottleUrlSource) => {
      const bottleId = bottle.id;
      if (intent) {
        return getAddBottleHref({
          bottleId,
          intent,
          pendingImageId: pendingImage?.id,
          pendingImageUrl: pendingImage?.imageUrl,
        });
      }
      if (directToTasting) {
        return getAddBottleHref({ bottleId, intent: "tasting" });
      }
      return getBottleUrl(bottle);
    },
    [directToTasting, intent, pendingImage?.id, pendingImage?.imageUrl],
  );

  const getContributionHref = useCallback(
    (nextQuery: string) =>
      getCreateBottleHref({
        pendingImage,
        query: nextQuery,
        returnAction: createReturnAction,
      }),
    [createReturnAction, pendingImage],
  );

  function submitSearch(nextQuery: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextQuery) nextParams.set("q", nextQuery);
    else nextParams.delete("q");
    replaceSearch(nextParams);
  }

  function updateScope(nextScope: SearchScope, nextQuery: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextQuery) nextParams.set("q", nextQuery);
    else nextParams.delete("q");
    if (nextScope === "all") nextParams.delete("type");
    else nextParams.set("type", nextScope);
    replaceSearch(nextParams);
  }

  function replaceSearch(nextParams: URLSearchParams) {
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/search?${nextQuery}` : "/search");
  }

  return (
    <div {...stylex.props(styles.page, databaseSearch && styles.databasePage)}>
      {!databaseSearch ? (
        <header {...stylex.props(styles.header)}>
          <h1 {...stylex.props(foundationStyles.pageTitle, styles.title)}>
            {getTitle({ directToTasting, intent, memberSearch })}
          </h1>
        </header>
      ) : null}
      <section aria-label="Search Peated" {...stylex.props(styles.search)}>
        <Search
          browseHeader={
            databaseSearch ? (
              <BrowseHeader bottleTotal={bottleTotal} />
            ) : undefined
          }
          getBottleHref={getBottleHref}
          getContributionHref={getContributionHref}
          initialQuery={query}
          initialResponse={initialResponse}
          initialScope={initialScope}
          key={`${query}:${initialScope}`}
          limit={databaseSearch ? 5 : 50}
          onScopeChange={databaseSearch ? updateScope : undefined}
          onSubmit={submitSearch}
          placement={databaseSearch ? "database" : "page"}
          placeholder={
            databaseSearch ? "Ardbeg 10, Supernova, Lagavulin…" : undefined
          }
          scopeValues={scopeValues}
          showBottleRatings={false}
          submitLabel={databaseSearch ? "Search" : undefined}
          typeaheadNavigation={false}
        />
      </section>
    </div>
  );
}

const styles = stylex.create({
  page: {
    width: "100%",
    maxWidth: "880px",
    marginRight: "auto",
    marginLeft: "auto",
  },
  databasePage: {
    maxWidth: "none",
  },
  header: { marginBottom: space.x4 },
  title: {
    fontSize: "clamp(26px, 4vw, 32px)",
    lineHeight: 1.1,
  },
  search: {
    minWidth: 0,
  },
  browseHeader: {
    maxWidth: "760px",
    marginRight: "auto",
    marginBottom: space.x6,
    marginLeft: "auto",
    paddingTop: space.x6,
    textAlign: "center",
  },
  browseTitle: {
    fontSize: "clamp(28px, 5vw, 38px)",
    lineHeight: 1.05,
  },
  browseDescription: {
    maxWidth: "720px",
    marginTop: space.x4,
    marginRight: "auto",
    marginBottom: 0,
    marginLeft: "auto",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.5,
  },
});
