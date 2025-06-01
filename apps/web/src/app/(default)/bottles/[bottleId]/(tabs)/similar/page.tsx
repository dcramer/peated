"use client";

import BetaNotice from "@peated/web/components/betaNotice";
import BottleTable from "@peated/web/components/bottleTable";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const orpc = useORPC();
  const { data: bottleList } = useSuspenseQuery(
    orpc.bottles.similar.queryOptions({
      input: {
        bottle: Number(bottleId),
      },
    })
  );

  return (
    <div className="mt-6 px-3 lg:px-0">
      <BetaNotice>This is a work in progress.</BetaNotice>

      <BottleTable bottleList={bottleList.results} rel={bottleList.rel} />
    </div>
  );
}
