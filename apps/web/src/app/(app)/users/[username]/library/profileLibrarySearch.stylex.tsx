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
import { foundationStyles } from "../../../../../styles/foundations.stylex";
import { space } from "../../../../../styles/tokens.stylex";

const SEARCH_DEBOUNCE_MS = 140;
const libraryScopes = [{ label: "Library", value: "library" }] as const;

/**
 * Suggests brands, producers, and Bottles from one member's Library while
 * they type. Picking a brand or producer filters the Library; picking a
 * Bottle opens it; Enter without a suggestion searches the Library text.
 */
export function ProfileLibrarySearch({
  onEntitySelect,
  onSubmit,
  query,
  userId,
}: {
  onEntitySelect: (entityId: number) => void;
  onSubmit: (query: string) => void;
  query: string;
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
  const searchQuery = useQuery({
    ...orpc.users.librarySearch.queryOptions({
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
        Find in this library
      </span>
      <SearchBox
        ariaLabel="Find in this library"
        emptyText={
          showResults && searchQuery.data && !groups.length
            ? "No brands, producers, or bottles in this library match."
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
        scope="library"
        scopes={libraryScopes}
        status={
          !showResults
            ? "ready"
            : searchQuery.isError
              ? "error"
              : searchQuery.isFetching
                ? "searching"
                : "ready"
        }
        statusText="Searching this library…"
      />
    </div>
  );
}

function toGroups(
  data: Outputs["users"]["librarySearch"],
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
