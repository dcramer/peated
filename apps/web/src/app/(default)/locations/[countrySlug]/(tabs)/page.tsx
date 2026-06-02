"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import PaginationButtons from "@peated/web/components/paginationButtons";
import TableSkeleton from "@peated/web/components/tableSkeleton";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";

function EntityList({ countrySlug }: { countrySlug: string }) {
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

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  return (
    <Suspense fallback={<TableSkeleton rows={20} columns={2} />}>
      <EntityList countrySlug={countrySlug} />
    </Suspense>
  );
}
