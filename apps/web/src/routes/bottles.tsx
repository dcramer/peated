import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_SORT = "-tastings";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
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
