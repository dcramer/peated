"use client";
import { use } from "react";

import BottleOverview from "@peated/web/components/bottleOverview";
import BottleStats from "@peated/web/components/bottleStats";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function BottleDetails(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const params = use(props.params);

  const { bottleId } = params;

  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({
      input: {
        bottle: Number(bottleId),
      },
    }),
  );

  return (
    <>
      <BottleStats bottle={bottle} />
      <BottleOverview bottle={bottle} />
    </>
  );
}
