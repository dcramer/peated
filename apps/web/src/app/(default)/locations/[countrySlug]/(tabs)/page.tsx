"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import PaginationButtons from "@peated/web/components/paginationButtons";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      country: countrySlug,
      type: "distiller",
      sort: "-bottles",
      limit: 20,
    },
  });

  const [[topEntityList]] = trpc.useSuspenseQueries((t) => [
    t.entityList(queryParams),
  ]);

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
