"use client";

import BottleTable from "@peated/web/components/bottleTable";
import { trpc } from "@peated/web/lib/trpc";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { useSearchParams } from "next/navigation";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  return {
    title: `Whiskies from ${entity.name}`,
  };
}

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
    ...Object.fromEntries(
      [...searchParams.entries()].map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
    entity: Number(entityId),
    sort: "brand",
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
