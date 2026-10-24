"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDebounceCallback } from "usehooks-ts";

import { SearchBox } from "@peated/web/components/searchBox.stylex";
import type {
  SearchResultGroup,
  SearchResultItem,
} from "@peated/web/components/searchResults.stylex";
import { getBottleIdentityProps } from "@peated/web/lib/bottleListItem";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getBottleUrl, getEntityUrl } from "@peated/web/lib/urls";
import { foundationStyles } from "../../../../styles/foundations.stylex";
import { space } from "../../../../styles/tokens.stylex";

const SEARCH_DEBOUNCE_MS = 140;
/** Labels and messages for each list the search covers. */
export const profileBottleSearchCopy = {
  library: {
    empty: "No brands, producers, or bottles in this library match.",
    label: "Find in this library",
    scopes: [{ label: "Library", value: "library" }],
    status: "Searching this library…",
  },
  tastings: {
    empty: "No brands, producers, or bottles in these tastings match.",
    label: "Find in these tastings",
    scopes: [{ label: "Tastings", value: "tastings" }],
    status: "Searching these tastings…",
  },
} as const;

/**
 * Suggests brands, producers, and Bottles from one member's Library or
 * tastings while they type. Picking a brand or producer filters the list;
 * picking a Bottle opens it; Enter without a suggestion searches the text.
 */
export function ProfileBottleSearch({
  onEntitySelect,
  onSubmit,
  query,
  scope,
  userId,
}: {
  onEntitySelect: (entityId: number) => void;
  onSubmit: (query: string) => void;
  query: string;
  scope: "library" | "tastings";
  userId: number;
}) {
  const orpc = useORPC();
  const router = useRouter();
  const [draft, setDraft] = useState({ source: query, value: query });
  const draftValue = draft.source === query ? draft.value : query;
  const [searchText, setSearchText] = useState(query.trim());
  const updateSearchText = useDebounceCallback(
    setSearchText,
    SEARCH_DEBOUNCE_MS,
  );
  const copy = profileBottleSearchCopy[scope];
  const searchRoute =
    scope === "library" ? orpc.users.librarySearch : orpc.users.tastingSearch;
  const searchQuery = useQuery({
    ...searchRoute.queryOptions({
      input: { user: userId, query: searchText },
    }),
    enabled: searchText.length > 0,
    placeholderData: keepPreviousData,
  });
  const showResults = draftValue.trim().length > 0 && searchText.length > 0;
  const groups =
    showResults && searchQuery.data ? toGroups(searchQuery.data) : [];

  function updateDraft(value: string) {
    setDraft({ source: query, value });
    updateSearchText(value.trim());
  }

  function selectResult(item: SearchResultItem) {
    const [kind, id] = item.id.split("-");
    if (kind === "entity") {
      updateDraft("");
      onEntitySelect(Number(id));
      return;
    }
    router.push(item.href);
  }

  return (
    <div {...stylex.props(styles.field)}>
      <span aria-hidden="true" {...stylex.props(foundationStyles.fieldLabel)}>
        {copy.label}
      </span>
      <SearchBox
        ariaLabel={copy.label}
        emptyText={
          showResults && searchQuery.data && !groups.length
            ? copy.empty
            : undefined
        }
        fluid
        // The header search keeps the page-wide `/` shortcut.
        focusShortcut={false}
        groups={groups}
        onQueryChange={updateDraft}
        onResultSelect={selectResult}
        onRetry={() => void searchQuery.refetch()}
        onScopeChange={() => {}}
        onSubmit={(value) => onSubmit(value.trim())}
        placeholder="Brand or bottle"
        query={draftValue}
        resultQuery={searchQuery.isPlaceholderData ? "" : searchText}
        scope={scope}
        scopes={copy.scopes}
        status={
          !showResults
            ? "ready"
            : searchQuery.isError
              ? "error"
              : searchQuery.isFetching
                ? "searching"
                : "ready"
        }
        statusText={copy.status}
      />
    </div>
  );
}

function toGroups(
  data: Outputs["users"]["librarySearch" | "tastingSearch"],
): SearchResultGroup[] {
  const entityItems = data.entities.map(({ entity }) => ({
    entity: getEntityIdentityProps(entity),
    href: getEntityUrl(entity),
    id: `entity-${entity.id}`,
    title: entity.name,
  }));
  const bottleItems = data.bottles.map((bottle) => {
    const identity = getBottleIdentityProps(bottle);
    return {
      bottle: identity,
      href: getBottleUrl(bottle),
      id: `bottle-${bottle.id}`,
      title: identity.name,
      visual: {
        kind: "bottle" as const,
        imageUrl: bottle.imageUrl,
        label: `${identity.name} bottle`,
      },
    };
  });

  return [
    ...(entityItems.length
      ? [{ id: "entities", items: entityItems, label: "Brands and producers" }]
      : []),
    ...(bottleItems.length
      ? [{ id: "bottles", items: bottleItems, label: "Bottles" }]
      : []),
  ];
}

const styles = stylex.create({
  field: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    minWidth: 0,
  },
});
