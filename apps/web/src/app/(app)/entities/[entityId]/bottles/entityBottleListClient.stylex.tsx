"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";

import { PageTabs } from "@peated/web/components";
import { BottleCatalogList } from "@peated/web/components/pages/bottleCatalog.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  BOTTLE_CATALOG_QUERY_FIELDS,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../../styles/tokens.stylex";

import { getDistilleryBottleView } from "../entityPageData";

const DEFAULT_SORT = "-release";

type BottleList = Outputs["bottles"]["list"];

const sortOptions = [
  { label: "Newest release", value: "-release" },
  { label: "Most tasted", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Brand and bottle", value: "brand" },
  { label: "Bottle name", value: "name" },
  { label: "Oldest age", value: "-age" },
] as const;

export function EntityBottleListClient({
  emptyAction,
  entityId,
  entityKind,
  entityName,
  initialDistilleryView,
  initialBottleList,
}: {
  emptyAction: ReactNode;
  entityId: number;
  entityKind: "brand" | "bottler" | "company" | "distillery";
  entityName: string;
  initialDistilleryView?: "other" | "releases";
  initialBottleList: BottleList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const distilleryView = getDistilleryBottleView(
    { kind: entityKind },
    searchParams.get("view") ?? undefined,
    initialDistilleryView,
  );
  const queryParams = normalizeBottleCatalogQueryParams(
    useApiQueryParams({
      defaults: { sort: DEFAULT_SORT },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: BOTTLE_CATALOG_QUERY_FIELDS,
      numericFields: [
        "age",
        "brand",
        "bottler",
        "cursor",
        "distiller",
        "entity",
        "limit",
        "series",
      ],
      overrides: {
        distilleryView,
        entity: entityId,
        limit: 25,
      },
    }),
  );
  const { data: bottleList, isFetching } = useSuspenseQuery({
    ...orpc.bottles.list.queryOptions({ input: queryParams }),
    initialData: initialBottleList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const [isNavigating, startTransition] = useTransition();
  const [sort, setSort] = useOptimistic(
    String(queryParams.sort ?? DEFAULT_SORT),
  );

  function getViewHref(view: "other" | "releases") {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", view);
    nextParams.delete("cursor");
    return buildSearchHref(pathname, nextParams);
  }

  function updateSort(value: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", value);
    nextParams.delete("cursor");
    startTransition(() => {
      setSort(value);
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  return (
    <div {...stylex.props(styles.content)}>
      {distilleryView ? (
        <div {...stylex.props(styles.views)}>
          <PageTabs
            ariaLabel={`Bottles for ${entityName}`}
            currentHref={getViewHref(distilleryView)}
            items={[
              {
                href: getViewHref("releases"),
                label: "Distillery releases",
              },
              { href: getViewHref("other"), label: "Other bottlings" },
            ]}
          />
        </div>
      ) : null}
      <BottleCatalogList
        emptyAction={emptyAction}
        emptyDescription={
          distilleryView === "releases"
            ? `No distillery releases have been added for ${entityName} yet.`
            : distilleryView === "other"
              ? `No other bottlings have been added for ${entityName} yet.`
              : `No bottles have been added for ${entityName} yet.`
        }
        emptyHeading={
          distilleryView === "releases"
            ? "No distillery releases yet"
            : distilleryView === "other"
              ? "No other bottlings yet"
              : "No bottles yet"
        }
        items={bottleList.results.map((bottle) =>
          toBottleListItem(bottle, {
            includeBottler: distilleryView === "other",
            includeRatings: true,
            includeRelatedReleases: true,
          }),
        )}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.nextCursor,
        )}
        onSortChange={updateSort}
        page={page}
        pending={isNavigating || isFetching}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.prevCursor,
        )}
        sort={sort}
        sortOptions={sortOptions}
        total={bottleList.total}
      />
    </div>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
  views: {
    marginBottom: space.x6,
  },
});
