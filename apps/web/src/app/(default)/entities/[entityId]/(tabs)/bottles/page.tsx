"use client";

import BottleTable from "@peated/web/components/bottleTable";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

export default function EntityTastings({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const searchParams = useSearchParams();
  const numericFields = new Set([
    "cursor",
    "limit",
    "age",
    "entity",
    "distiller",
    "bottler",
    "entity",
  ]);

  const [bottleList] = trpc.bottleList.useSuspenseQuery({
    sort: "brand",
    ...Object.fromEntries(
      [...searchParams.entries()].map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
    entity: Number(entityId),
    limit: 100,
  });

  return (
    <>
      <BottleTable
        bottleList={bottleList.results}
        rel={bottleList.rel}
        groupBy={(bottle) => bottle.brand}
        groupTo={(group) => `/entities/${group.id}`}
      />
    </>
  );
}
