"use client";

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
import { foundationStyles } from "../../../styles/foundations.stylex";
import { space } from "../../../styles/tokens.stylex";

const addBottleIntents = [
  "catalog",
  "choose",
  "library",
  "tasting",
  "view",
] as const satisfies readonly AddBottleRouteIntent[];

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

export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const intent = getAddBottleIntent(searchParams.get("intent"));
  const directToTasting = searchParams.has("tasting");
  const memberSearch = searchParams.get("type") === "users";
  const bottleSelection = Boolean(intent) || directToTasting;
  const pendingImage = getPendingImageFromParams(searchParams);
  const initialScope: SearchScope = memberSearch
    ? "members"
    : bottleSelection
      ? "bottles"
      : "all";
  const scopeValues = memberSearch
    ? (["members"] as const)
    : bottleSelection
      ? (["bottles"] as const)
      : undefined;
  const createReturnAction = getCreateReturnAction(intent, directToTasting);

  const getBottleHref = useCallback(
    (bottleId: number) => {
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
      return `/bottles/${bottleId}`;
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
    router.replace(`/search?${nextParams.toString()}`);
  }

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <h1 {...stylex.props(foundationStyles.pageTitle, styles.title)}>
          {getTitle({ directToTasting, intent, memberSearch })}
        </h1>
      </header>
      <section aria-label="Search Peated" {...stylex.props(styles.search)}>
        <Search
          getBottleHref={getBottleHref}
          getContributionHref={getContributionHref}
          initialQuery={query}
          initialScope={initialScope}
          limit={50}
          onSubmit={submitSearch}
          placement="page"
          scopeValues={scopeValues}
          showBottleMeasures={false}
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
  header: { marginBottom: space.x4 },
  title: {
    fontSize: "clamp(26px, 4vw, 32px)",
    lineHeight: 1.1,
  },
  search: {
    minWidth: 0,
  },
});
