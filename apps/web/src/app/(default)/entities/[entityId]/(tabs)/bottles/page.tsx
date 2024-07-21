"use client";

import BottleTable from "@peated/web/components/bottleTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

export default function EntityTastings({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
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
      entity: parseInt(entityId, 10),
      limit: 100,
    },
  });

  const [bottleList] = trpc.bottleList.useSuspenseQuery(queryParams);

  // const groupBy = !entity.type.includes("distiller") ? (item) => item.brand : null;

  return (
    <>
      <BottleTable
        bottleList={bottleList.results}
        rel={bottleList.rel}
        groupBy={(item) => item.brand}
        groupTo={(group) => `/entities/${group.id}`}
        withSearch
      />
    </>
  );
}
