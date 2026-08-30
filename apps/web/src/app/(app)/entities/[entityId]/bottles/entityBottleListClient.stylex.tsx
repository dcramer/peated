"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { BottleCatalogList } from "@peated/web/components/designSystem/patterns/bottleCatalog.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { toBottleCatalogItem } from "@peated/web/lib/bottleCatalogItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../../styles/tokens.stylex";

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
  entityName,
  initialBottleList,
}: {
  emptyAction: ReactNode;
  entityId: number;
  entityName: string;
  initialBottleList: BottleList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParams = useApiQueryParams({
    defaults: { sort: DEFAULT_SORT },
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
      entity: entityId,
      limit: 25,
    },
  });
  const { data: bottleList } = useSuspenseQuery({
    ...orpc.bottles.list.queryOptions({ input: queryParams }),
    initialData: initialBottleList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  function updateSort(value: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", value);
    nextParams.delete("cursor");
    router.push(buildSearchHref(pathname, nextParams));
  }

  return (
    <div {...stylex.props(styles.content)}>
      <BottleCatalogList
        emptyAction={emptyAction}
        emptyDescription={`No bottles have been added for ${entityName} yet.`}
        emptyHeading="No bottles yet"
        items={bottleList.results.map(toBottleCatalogItem)}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.nextCursor,
        )}
        onSortChange={updateSort}
        page={page}
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
});
