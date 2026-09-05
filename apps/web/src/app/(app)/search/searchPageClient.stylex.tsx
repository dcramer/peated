"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useOptimistic, useTransition } from "react";

import { LoadingList, LoadingPlaceholder } from "@peated/web/components";
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
import { colors, controlMetrics, space } from "../../../styles/tokens.stylex";

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
      <h1
        {...stylex.props(
          foundationStyles.pageTitle,
          foundationStyles.pageTitleCompact,
        )}
      >
        Search the database
      </h1>
      <p {...stylex.props(foundationStyles.body, styles.browseDescription)}>
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
    return "Rate this bottle";
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
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
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
    const nextParams = new URLSearchParams(displayedParams);
    if (nextQuery) nextParams.set("q", nextQuery);
    else nextParams.delete("q");
    replaceSearch(nextParams);
  }

  function updateScope(nextScope: SearchScope, nextQuery: string) {
    const nextParams = new URLSearchParams(displayedParams);
    if (nextQuery) nextParams.set("q", nextQuery);
    else nextParams.delete("q");
    if (nextScope === "all") nextParams.delete("type");
    else nextParams.set("type", nextScope);
    replaceSearch(nextParams);
  }

  function replaceSearch(nextParams: URLSearchParams) {
    const nextQuery = nextParams.toString();
    startTransition(() => {
      setDisplayedParams(nextQuery);
      router.replace(nextQuery ? `/search?${nextQuery}` : "/search", {
        scroll: false,
      });
    });
  }

  return (
    <div {...stylex.props(styles.page, databaseSearch && styles.databasePage)}>
      {!databaseSearch ? (
        <header {...stylex.props(styles.header)}>
          <h1
            {...stylex.props(
              foundationStyles.pageTitle,
              foundationStyles.pageTitleCompact,
            )}
          >
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
          pending={isNavigating}
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

export function SearchLoadingSelection() {
  const searchParams = useSearchParams();
  const intent = getAddBottleIntent(searchParams.get("intent"));
  const directToTasting = searchParams.has("tasting");
  const memberSearch = searchParams.get("type") === "users";
  const databaseSearch = !memberSearch && !intent && !directToTasting;

  return (
    <SearchPageLoading
      databaseSearch={databaseSearch}
      hasQuery={Boolean(searchParams.get("q")?.trim())}
      title={getTitle({ directToTasting, intent, memberSearch })}
    />
  );
}

export function SearchPageLoading({
  databaseSearch = true,
  hasQuery = false,
  title = "Search",
}: {
  databaseSearch?: boolean;
  hasQuery?: boolean;
  title?: string;
}) {
  const searchRow = (
    <div aria-hidden="true" {...stylex.props(styles.loadingSearchRow)}>
      <span {...stylex.props(styles.loadingSearchInput)} />
      <span {...stylex.props(styles.loadingSearchButton)} />
    </div>
  );

  return (
    <div
      aria-busy="true"
      aria-label="Loading search"
      role="status"
      {...stylex.props(styles.page, databaseSearch && styles.databasePage)}
    >
      {!databaseSearch ? (
        <header {...stylex.props(styles.header)}>
          <h1
            {...stylex.props(
              foundationStyles.pageTitle,
              foundationStyles.pageTitleCompact,
            )}
          >
            {title}
          </h1>
        </header>
      ) : null}
      <section aria-label="Search Peated" {...stylex.props(styles.search)}>
        {databaseSearch && !hasQuery ? (
          <>
            <header {...stylex.props(styles.browseHeader)}>
              <h1
                {...stylex.props(
                  foundationStyles.pageTitle,
                  foundationStyles.pageTitleCompact,
                )}
              >
                Search the database
              </h1>
              <div {...stylex.props(styles.loadingBrowseDescription)}>
                <span {...stylex.props(styles.loadingDescriptionLine)} />
                <span
                  {...stylex.props(
                    styles.loadingDescriptionLine,
                    styles.loadingDescriptionLineShort,
                  )}
                />
              </div>
            </header>
            <div {...stylex.props(styles.loadingBrowseSearch)}>{searchRow}</div>
          </>
        ) : databaseSearch ? (
          <div {...stylex.props(styles.loadingDatabaseLayout)}>
            <div {...stylex.props(styles.loadingDatabaseMain)}>
              {searchRow}
              <div {...stylex.props(styles.loadingResults)}>
                <LoadingPlaceholder preset="metadata" />
                <LoadingList label="Loading search results" rows={5} />
              </div>
            </div>
            <aside {...stylex.props(styles.loadingSearchFilters)}>
              <LoadingPlaceholder preset="metadata" />
              <LoadingList
                label="Loading search filters"
                rows={4}
                variant="text"
              />
            </aside>
          </div>
        ) : (
          <div {...stylex.props(styles.loadingPageSearch)}>
            {searchRow}
            {hasQuery ? (
              <div {...stylex.props(styles.loadingResults)}>
                <LoadingList label="Loading search results" rows={5} />
              </div>
            ) : null}
          </div>
        )}
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

  browseDescription: {
    maxWidth: "720px",
    marginTop: space.x4,
    marginRight: "auto",
    marginBottom: 0,
    marginLeft: "auto",
    color: colors.inkMuted,
  },
  loadingBrowseDescription: {
    display: "flex",
    maxWidth: "720px",
    flexDirection: "column",
    alignItems: "center",
    gap: space.x2,
    marginTop: space.x4,
    marginRight: "auto",
    marginLeft: "auto",
  },
  loadingDescriptionLine: {
    display: "block",
    width: "86%",
    height: "18px",
    borderRadius: "2px",
    backgroundColor: colors.surface,
  },
  loadingDescriptionLineShort: { width: "62%" },
  loadingBrowseSearch: {
    width: "100%",
    maxWidth: "660px",
    marginRight: "auto",
    marginLeft: "auto",
  },
  loadingSearchRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x2,
  },
  loadingSearchInput: {
    display: "block",
    minWidth: 0,
    height: controlMetrics.controlHeight,
    flex: 1,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingSearchButton: {
    display: "block",
    width: "81px",
    height: controlMetrics.controlHeight,
    flexShrink: 0,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingDatabaseLayout: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: space.x12,
    alignItems: "start",
    "@media (max-width: 759px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  loadingDatabaseMain: { minWidth: 0 },
  loadingPageSearch: { maxWidth: "880px" },
  loadingResults: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    marginTop: space.x4,
  },
  loadingSearchFilters: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x3,
    paddingTop: "2px",
    "@media (max-width: 759px)": { display: "none" },
  },
});
