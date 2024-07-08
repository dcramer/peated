"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

const DEFAULT_SORT = "-tastings";

export default function Page() {
  const searchParams = useSearchParams();

  const numericFields = new Set(["cursor", "limit", "country", "region"]);

  const [entityList] = trpc.entityList.useSuspenseQuery({
    ...Object.fromEntries(
      Array.from(searchParams.entries()).map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
    type: "distiller",
  });

  return (
    <>
      {entityList.results.length > 0 ? (
        <EntityTable
          entityList={entityList.results}
          rel={entityList.rel}
          sort={searchParams.get("sort") || DEFAULT_SORT}
          type="distiller"
          withLocations
        />
      ) : (
        <EmptyActivity>
          {"Looks like there's nothing in the database yet. Weird."}
        </EmptyActivity>
      )}
    </>
  );
}
