import BottleTable from "@peated/web/components/bottleTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/entities/$entityId/bottles")({
  component: Page,
});

function Page() {
  const { entityId } = Route.useParams();
  const orpc = useORPC();
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "brand",
    },
    numericFields: [
      "cursor",
      "limit",
      "age",
      "entity",
      "distiller",
      "bottler",
      "entity",
    ],
    overrides: {
      entity: Number.parseInt(entityId, 10),
      limit: 100,
    },
  });

  const { data: bottleList } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: queryParams,
    })
  );

  // const groupBy = !entity.type.includes("distiller") ? (item) => item.brand : null;

  return (
    <>
      <BottleTable
        bottleList={bottleList.results}
        rel={bottleList.rel}
        groupBy={(item) => item.brand}
        groupItem={(item) => item.shortName || item.name}
        groupTo={(group) => `/entities/${group.id}`}
        withSearch
      />
    </>
  );
}
