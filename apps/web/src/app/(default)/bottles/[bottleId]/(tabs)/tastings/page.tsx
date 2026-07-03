"use client";
import { use } from "react";

import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function BottleTastings(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const params = use(props.params);

  const { bottleId } = params;

  const orpc = useORPC();
  const { data: tastingList } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      input: {
        bottle: Number(bottleId),
      },
    }),
  );

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} noBottle />
      ) : (
        <EmptyActivity
          href={getAddBottleHref({
            bottleId,
            intent: "tasting",
          })}
        >
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="font-muted mt-2 block">
            Looks like no ones recorded this spirit. You could be the first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
