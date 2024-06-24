"use client";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

const DEFAULT_SORT = "-tastings";

const numericFields = new Set([
  "cursor",
  "limit",
  "age",
  "entity",
  "distiller",
  "bottler",
  "entity",
]);

export default function BottleList() {
  const searchParams = useSearchParams();

  const [bottleList] = trpc.bottleList.useSuspenseQuery(
    Object.fromEntries(
      Array.from(searchParams.entries()).map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
  );

  return (
    <>
      {bottleList.results.length > 0 ? (
        <BottleTable
          bottleList={bottleList.results}
          rel={bottleList.rel}
          sort={searchParams.get("sort") || DEFAULT_SORT}
        />
      ) : (
        <EmptyActivity>
          {"Looks like there's nothing in the database yet. Weird."}
        </EmptyActivity>
      )}
    </>
  );
}
