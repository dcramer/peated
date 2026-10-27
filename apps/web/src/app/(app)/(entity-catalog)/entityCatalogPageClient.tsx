"use client";

import { MAJOR_COUNTRIES } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import type { Outputs } from "@peated/server/orpc/router";
import type { EntityKind } from "@peated/server/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import { FacetGroup } from "@peated/web/components/filterPanel.stylex";
import { CatalogPage } from "@peated/web/components/pages/catalogPage.stylex";
import {
  EntityCatalogFacets,
  EntityCatalogList,
} from "@peated/web/components/pages/entityCatalog.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import useEntityFollowing from "@peated/web/hooks/useEntityFollowing";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { toEntityCatalogItem } from "@peated/web/lib/entityCatalogItem";
import { filterFollowingEntities } from "@peated/web/lib/entityFollowing";
import { useORPC } from "@peated/web/lib/orpc/context";

const DEFAULT_SORT = "-tastings";

const sortOptions = [
  { label: "Most reviewed", value: "-tastings" },
  { label: "Most bottles", value: "-bottles" },
  { label: "Name", value: "name" },
  { label: "Recently added", value: "-created" },
] as const;

type EntityList = Outputs["distilleries"]["list"];
export type EntityCatalogKind = Extract<
  EntityKind,
  "bottler" | "brand" | "company" | "distillery"
>;

const catalogConfig = {
  bottler: { noun: "bottler", title: "Bottlers" },
  brand: { noun: "brand", title: "Brands" },
  company: { noun: "company", title: "Companies" },
  distillery: { noun: "distiller", title: "Distillers" },
} satisfies Record<EntityCatalogKind, { noun: string; title: string }>;

const countryOptions = MAJOR_COUNTRIES.map(([label, value]) => ({
  label,
  value,
}));

export function EntityCatalogPageClient({
  initialEntityList,
  kind,
}: {
  initialEntityList: EntityList;
  kind: EntityCatalogKind;
}) {
  const config = catalogConfig[kind];
  const orpc = useORPC();
  const { user } = useAuth();
  const followControls = useEntityFollowing();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
  const displayedSearchParams = new URLSearchParams(displayedParams);
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
  });
  const listQueryOptions =
    kind === "distillery"
      ? orpc.distilleries.list.queryOptions({ input: queryParams })
      : kind === "brand"
        ? orpc.brands.list.queryOptions({ input: queryParams })
        : kind === "bottler"
          ? orpc.bottlers.list.queryOptions({ input: queryParams })
          : orpc.companies.list.queryOptions({ input: queryParams });
  const { data: entityList, isFetching } = useSuspenseQuery({
    ...listQueryOptions,
    initialData: initialEntityList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort = displayedSearchParams.get("sort") ?? DEFAULT_SORT;
  const country = displayedSearchParams.get("country") ?? "";
  const query = displayedSearchParams.get("query") ?? "";
  const region = displayedSearchParams.get("region") ?? "";
  const hasFilters = Boolean(country || query || region);
  const filter =
    searchParams.get("filter") === "following" ? "following" : "all";
  const displayedFilter =
    displayedSearchParams.get("filter") === "following" ? "following" : "all";
  const showFollowing = Boolean(user && kind !== "company");

  function navigate(nextParams: URLSearchParams) {
    startTransition(() => {
      // Catalog queries follow the committed URL; only controls anticipate navigation.
      setDisplayedParams(nextParams.toString());
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(displayedParams);

    Object.entries(updates).forEach(([name, value]) => {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    });
    if ("country" in updates) nextParams.delete("region");
    nextParams.delete("cursor");
    navigate(nextParams);
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(displayedParams);
    ["country", "cursor", "filter", "query", "region"].forEach((name) =>
      nextParams.delete(name),
    );
    navigate(nextParams);
  }

  const addHref = `/addEntity?kind=${kind}`;
  const visibleList =
    filter === "following"
      ? filterFollowingEntities(entityList, followControls.isFollowing)
      : entityList;
  const items = visibleList.results.map((entity) =>
    toEntityCatalogItem(entity, followControls.isFollowing(entity)),
  );

  return (
    <CatalogPage
      action={
        <ButtonLink href={addHref} size="md" variant="tonal">
          Add {config.noun}
        </ButtonLink>
      }
      title={config.title}
    >
      <EntityCatalogList
        activeFilterCount={
          [
            country,
            query,
            region,
            displayedFilter === "following" ? displayedFilter : "",
          ].filter(Boolean).length
        }
        addHref={addHref}
        emptyAction={
          filter === "following" && !hasFilters ? (
            <Button
              onClick={() => updateParams({ filter: "" })}
              size="sm"
              variant="tonal"
            >
              Browse all {config.title.toLowerCase()}
            </Button>
          ) : undefined
        }
        emptyDescription={
          filter === "following"
            ? hasFilters
              ? `No ${config.title.toLowerCase()} you follow match these filters.`
              : `Follow a ${config.noun} to add it to this list.`
            : undefined
        }
        emptyHeading={
          filter === "following"
            ? `You don't follow any ${config.title.toLowerCase()} yet`
            : undefined
        }
        filters={
          <>
            {showFollowing ? (
              <FacetGroup
                label="Show"
                required
                onChange={(value) =>
                  updateParams({ filter: value === "following" ? value : "" })
                }
                options={[
                  {
                    label: `All ${config.title.toLowerCase()}`,
                    value: "all",
                  },
                  { label: "Following", value: "following" },
                ]}
                selected={displayedFilter}
              />
            ) : null}
            <EntityCatalogFacets
              countries={countryOptions}
              country={country}
              onCountryChange={(value) => updateParams({ country: value })}
              onRegionClear={
                region ? () => updateParams({ region: "" }) : undefined
              }
              region={region ? formatRegion(region) : undefined}
            />
          </>
        }
        items={items}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          entityList.rel.nextCursor,
        )}
        noun={config.noun}
        onClear={
          hasFilters || displayedFilter === "following"
            ? clearFilters
            : undefined
        }
        onToggleFollowing={
          showFollowing
            ? (item) =>
                followControls.toggle({
                  id: item.id,
                  isFollowing: item.isFollowing,
                })
            : undefined
        }
        onSortChange={(value) => updateParams({ sort: value })}
        page={page}
        pending={isNavigating || isFetching}
        pendingIds={followControls.pendingIds}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          entityList.rel.prevCursor,
        )}
        query={{
          label: `Find a ${config.noun}`,
          onSubmit: (value) => updateParams({ query: value }),
          placeholder: "Name",
          query,
        }}
        showFollowingMarks={filter !== "following"}
        sort={sort}
        sortOptions={sortOptions}
        total={visibleList.total}
      />
    </CatalogPage>
  );
}

function formatRegion(region: string) {
  return /^\d+$/.test(region)
    ? `Region ${region}`
    : toTitleCase(region.replaceAll("-", " "));
}
