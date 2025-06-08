import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EntitiesSidebarLayout } from "../layouts";

const DEFAULT_SORT = "-tastings";

export const Route = createFileRoute("/brands/")({
  component: Page,
});

function Page() {
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
    })
  );

  return (
    <EntitiesSidebarLayout entityType="brand">
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
    </EntitiesSidebarLayout>
  );
}
