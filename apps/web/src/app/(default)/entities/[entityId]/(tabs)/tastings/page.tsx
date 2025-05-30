"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function EntityTastings({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const orpc = useORPC();

  const { data: tastingList } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      entity: Number(entityId),
    }),
  );

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} />
      ) : (
        <EmptyActivity href={`/search?tasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="font-muted mt-2 block">
            Looks like no ones recorded any related spirit. You could be the
            first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
