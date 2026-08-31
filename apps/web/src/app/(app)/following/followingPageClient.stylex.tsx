"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Button,
  ButtonLink,
  FacetGroup,
  FilterPanel,
  FilterQuery,
  PageTabs,
} from "@peated/web/components";
import { CatalogPage } from "@peated/web/components/pages/catalogPage.stylex";
import { EntityCatalogList } from "@peated/web/components/pages/entityCatalog.stylex";
import useEntityFollowing from "@peated/web/hooks/useEntityFollowing";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { toEntityCatalogItem } from "@peated/web/lib/entityCatalogItem";
import { useORPC } from "@peated/web/lib/orpc/context";

import { getFollowingPageState } from "./followingPageData";

type EntityList = Outputs["entities"]["list"];

const sortOptions = [
  { label: "Name", value: "name" },
  { label: "Most tasted", value: "-tastings" },
  { label: "Recently added", value: "-created" },
] as const;

const typeOptions = [
  { label: "Distillers", value: "distillery" },
  { label: "Brands", value: "brand" },
  { label: "Bottlers", value: "bottler" },
] as const;

export function FollowingPageClient({
  initialEntityList,
}: {
  initialEntityList: EntityList;
}) {
  const orpc = useORPC();
  const followControls = useEntityFollowing();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = getFollowingPageState(Object.fromEntries(searchParams));
  const listQueryOptions = orpc.entities.list.queryOptions({
    input: state.input,
  });
  const { data: entityList } = useSuspenseQuery({
    ...listQueryOptions,
    initialData: initialEntityList,
  });
  const followingHref = getViewHref(pathname, searchParams, "following");
  const findHref = getViewHref(pathname, searchParams, "find");
  const visibleEntities =
    state.view === "following"
      ? entityList.results.filter(followControls.isFollowing)
      : entityList.results;
  const items = visibleEntities.map((entity) =>
    toEntityCatalogItem(entity, followControls.isFollowing(entity)),
  );

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([name, value]) => {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    });
    nextParams.delete("cursor");
    router.push(buildSearchHref(pathname, nextParams));
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    ["cursor", "query", "type"].forEach((name) => nextParams.delete(name));
    router.push(buildSearchHref(pathname, nextParams));
  }

  const noMatches = state.hasFilters;

  return (
    <CatalogPage
      eyebrow="Your record"
      filters={
        <FilterPanel ariaLabel="Following filters">
          <FilterQuery
            key={state.query}
            label="Name"
            onSubmit={(value) => updateParams({ query: value })}
            placeholder="Distiller, brand, or bottler"
            query={state.query}
          />
          <FacetGroup
            label="Type"
            onChange={(value) => updateParams({ type: value })}
            options={typeOptions}
            selected={state.type === "all" ? "" : state.type}
          />
          <Button align="start" onClick={clearFilters} size="sm" variant="text">
            Clear filters
          </Button>
        </FilterPanel>
      }
      navigation={
        <PageTabs
          ariaLabel="Following views"
          currentHref={state.view === "following" ? followingHref : findHref}
          items={[
            { href: followingHref, label: "Following" },
            { href: findHref, label: "Find more" },
          ]}
        />
      }
      title="Following"
    >
      <EntityCatalogList
        emptyAction={
          state.view === "following" && !noMatches ? (
            <ButtonLink href={findHref} size="sm" variant="tonal">
              Find one
            </ButtonLink>
          ) : undefined
        }
        emptyDescription={
          noMatches
            ? "Try a broader search or choose another type."
            : state.view === "following"
              ? "Find a distiller, brand, or bottler to start."
              : "Add the missing record if it isn't in Peated yet."
        }
        emptyHeading={
          noMatches
            ? "Nothing matches"
            : state.view === "following"
              ? "Nothing followed yet"
              : "Nothing here yet"
        }
        items={items}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          entityList.rel.nextCursor,
        )}
        noun="result"
        onClear={noMatches ? clearFilters : undefined}
        onSortChange={(value) => updateParams({ sort: value })}
        onToggleFollowing={(item) =>
          followControls.toggle({
            id: item.id,
            isFollowing: item.isFollowing,
          })
        }
        page={state.cursor}
        pendingId={followControls.pendingId}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          entityList.rel.prevCursor,
        )}
        showFollowingMarks={state.view === "find"}
        sort={state.sort}
        sortOptions={sortOptions}
      />
    </CatalogPage>
  );
}

function getViewHref(
  pathname: string,
  searchParams: { toString(): string },
  view: "find" | "following",
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  if (view === "find") nextParams.set("view", "find");
  else nextParams.delete("view");
  nextParams.delete("cursor");
  return buildSearchHref(pathname, nextParams);
}
