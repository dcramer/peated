"use client";
import { use } from "react";

import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import PaginationButtons from "@peated/web/components/paginationButtons";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const params = use(props.params);

  const { countrySlug } = params;

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
    }),
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
