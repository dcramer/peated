import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import PaginationButtons from "@peated/web/components/paginationButtons";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/locations/$countrySlug")({
  component: Page,
});

function Page() {
  const { countrySlug } = Route.useParams();
  const orpc = useORPC();
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      country: countrySlug,
      type: "distiller",
      sort: "-bottles",
      limit: 20,
    },
  });

  const { data: topEntityList } = useSuspenseQuery(
    orpc.entities.list.queryOptions({
      input: queryParams,
    })
  );

  return (
    <>
      {topEntityList.results.length ? (
        <EntityTable
          entityList={topEntityList.results}
          type="distiller"
          defaultSort="-bottles"
          withSearch
        />
      ) : (
        <EmptyActivity>
          {"It looks like we don't know of any distilleries in the area."}
        </EmptyActivity>
      )}

      <PaginationButtons rel={topEntityList.rel} />
    </>
  );
}
