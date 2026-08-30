"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { Outputs } from "@peated/server/orpc/router";
import type { Entity, EntityKind } from "@peated/server/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ButtonLink } from "@peated/web/components/designSystem/components";
import { CatalogPage } from "@peated/web/components/designSystem/patterns/catalogPage.stylex";
import {
  EntityCatalogFilters,
  EntityCatalogList,
  type EntityCatalogItem,
} from "@peated/web/components/designSystem/patterns/entityCatalog.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";

const DEFAULT_SORT = "-tastings";

const sortOptions = [
  { label: "Most tasted", value: "-tastings" },
  { label: "Most bottles", value: "-bottles" },
  { label: "Name", value: "name" },
  { label: "Recently added", value: "-created" },
] as const;

type EntityList = Outputs["distilleries"]["list"];
type CountryList = Outputs["countries"]["list"];
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

export function EntityCatalogPageClient({
  initialCountryList,
  initialEntityList,
  kind,
}: {
  initialCountryList: CountryList;
  initialEntityList: EntityList;
  kind: EntityCatalogKind;
}) {
  const config = catalogConfig[kind];
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const { data: entityList } = useSuspenseQuery({
    ...listQueryOptions,
    initialData: initialEntityList,
  });
  const { data: countryList } = useSuspenseQuery({
    ...orpc.countries.list.queryOptions({
      input: { onlyMajor: true, sort: "-bottles" },
    }),
    initialData: initialCountryList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;
  const country = searchParams.get("country") ?? "";
  const query = searchParams.get("query") ?? "";
  const region = searchParams.get("region") ?? "";
  const hasFilters = Boolean(country || query || region);

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([name, value]) => {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    });
    if ("country" in updates) nextParams.delete("region");
    nextParams.delete("cursor");
    router.push(buildSearchHref(pathname, nextParams));
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    ["country", "cursor", "query", "region"].forEach((name) =>
      nextParams.delete(name),
    );
    router.push(buildSearchHref(pathname, nextParams));
  }

  const addHref = `/addEntity?kind=${kind}`;
  const items = entityList.results.map(toCatalogItem);

  return (
    <CatalogPage
      action={
        <ButtonLink href={addHref} size="md" variant="tonal">
          Add {config.noun}
        </ButtonLink>
      }
      filters={
        <EntityCatalogFilters
          countries={countryList.results.map((item) => ({
            label: item.name,
            value: String(item.id),
          }))}
          country={country}
          key={query}
          onClear={clearFilters}
          onCountryChange={(value) => updateParams({ country: value })}
          onQuerySubmit={(value) => updateParams({ query: value })}
          onRegionClear={
            region ? () => updateParams({ region: "" }) : undefined
          }
          query={query}
          region={region ? formatRegion(region) : undefined}
        />
      }
      title={config.title}
    >
      <EntityCatalogList
        addHref={addHref}
        items={items}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          entityList.rel.nextCursor,
        )}
        noun={config.noun}
        onClear={hasFilters ? clearFilters : undefined}
        onSortChange={(value) => updateParams({ sort: value })}
        page={page}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          entityList.rel.prevCursor,
        )}
        sort={sort}
        sortOptions={sortOptions}
      />
    </CatalogPage>
  );
}

function toCatalogItem(entity: Entity): EntityCatalogItem {
  const location = [entity.region?.name, entity.country?.name]
    .filter((value): value is string => Boolean(value))
    .join(", ");
  const metadata = [
    entity.peatedId,
    toTitleCase(entity.kind),
    location || null,
  ].filter((value): value is string => value !== null);

  return {
    href: getEntityUrl(entity),
    id: entity.peatedId,
    metadata,
    name: entity.name,
    totalBottles: entity.totalBottles,
    totalTastings: entity.totalTastings,
  };
}

function formatRegion(region: string) {
  return /^\d+$/.test(region)
    ? `Region ${region}`
    : toTitleCase(region.replaceAll("-", " "));
}
