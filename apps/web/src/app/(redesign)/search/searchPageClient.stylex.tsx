"use client";

import * as stylex from "@stylexjs/stylex";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { PageHeader } from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import {
  Search,
  type SearchScope,
} from "@peated/web/components/designSystem/product/search.stylex";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import {
  getAddBottleHref,
  getPendingImageFromParams,
  type AddBottleRouteIntent,
} from "@peated/web/lib/addBottle";
import { space } from "../../../styles/tokens.stylex";

const addBottleIntents = [
  "addBottle",
  "choose",
  "library",
  "tasting",
  "view",
] as const satisfies readonly AddBottleRouteIntent[];

function getAddBottleIntent(value: string | null) {
  return addBottleIntents.find((intent) => intent === value);
}

function getCreateReturnAction(
  intent: AddBottleRouteIntent | undefined,
  directToTasting: boolean,
) {
  if (intent === "choose" || intent === "addBottle") return "addBottle";
  if (intent === "library" || intent === "tasting" || intent === "view") {
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
  if (intent === "library") return "Choose a bottle for your Library";
  if (intent === "tasting" || directToTasting) {
    return "Choose a bottle to taste";
  }
  if (intent) return "Choose a bottle";
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
      <PageHeader title={getTitle({ directToTasting, intent, memberSearch })} />
      <section aria-label="Search Peated" {...stylex.props(styles.search)}>
        <Search
          autoFocus
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
  },
  search: {
    marginTop: space.x6,
  },
});
