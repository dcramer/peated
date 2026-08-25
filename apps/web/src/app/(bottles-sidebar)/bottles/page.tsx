"use client";

import BottleTable from "@peated/web/components/bottleTable";
import CatalogPageHeader from "@peated/web/components/catalogPageHeader";
import EmptyActivity from "@peated/web/components/emptyActivity";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

const DEFAULT_SORT = "-tastings";

export default function BottleList() {
  const orpc = useORPC();
  const queryParams = useApiQueryParams({
    numericFields: [
      "cursor",
      "limit",
      "age",
      "entity",
      "distiller",
      "bottler",
      "series",
      "entity",
    ],
    overrides: {
      limit: 100,
    },
  });

  const { data: bottleList } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: queryParams,
    }),
  );

  return (
    <>
      <CatalogPageHeader
        title="Bottles"
        actionHref="/bottles/new?returnTo=%2Fbottles"
        actionLabel="Create bottle"
      />
      {bottleList.results.length > 0 ? (
        <BottleTable
          bottleList={bottleList.results}
          rel={bottleList.rel}
          defaultSort={DEFAULT_SORT}
        />
      ) : (
        <EmptyActivity>
          {"Looks like there's nothing in the database yet. Weird."}
        </EmptyActivity>
      )}
    </>
  );
}
