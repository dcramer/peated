"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

const DEFAULT_SORT = "-tastings";

export default function Page() {
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit", "country", "region"],
    overrides: {
      type: "distiller",
    },
  });

  const [entityList] = trpc.entityList.useSuspenseQuery(queryParams);

  return (
    <>
      {entityList.results.length > 0 ? (
        <EntityTable
          entityList={entityList.results}
          rel={entityList.rel}
          defaultSort={DEFAULT_SORT}
          type="distiller"
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
