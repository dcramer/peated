"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { trpc } from "@peated/web/lib/trpc/client";
import { useSearchParams } from "next/navigation";

export default function Page({
  params: { countrySlug, regionSlug },
}: {
  params: { countrySlug: string; regionSlug: string };
}) {
  const searchParams = useSearchParams();
  const [[topEntityList]] = trpc.useSuspenseQueries((t) => [
    t.entityList({
      ...Object.fromEntries(searchParams.entries()),
      country: countrySlug,
      region: regionSlug,
      type: "distiller",
      sort: "-bottles",
      limit: 20,
    }),
  ]);

  return (
    <>
      {topEntityList.results.length ? (
        <EntityTable entityList={topEntityList.results} type="distiller" />
      ) : (
        <EmptyActivity>
          {"It looks like we don't know of any distilleries in the area."}
        </EmptyActivity>
      )}

      <PaginationButtons rel={topEntityList.rel} />
    </>
  );
}
