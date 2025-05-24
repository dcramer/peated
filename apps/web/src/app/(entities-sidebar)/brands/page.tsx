"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

const DEFAULT_SORT = "-tastings";

export default function Page() {
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit", "country", "region"],
    overrides: {
      type: "brand",
    },
  });

  const orpc = useORPC();
  const { data: entityList } = useSuspenseQuery(
    orpc.entities.list.queryOptions({
      input: queryParams,
    }),
  );

  return (
    <>
      {entityList.results.length > 0 ? (
        <EntityTable
          entityList={entityList.results}
          rel={entityList.rel}
          defaultSort={DEFAULT_SORT}
          type="brand"
          withLocations
          withSearch
        />
      ) : (
        <EmptyActivity>
          {"Looks like there's nothing in the database yet. Weird."}
        </EmptyActivity>
      )}
    </>
  );
}
