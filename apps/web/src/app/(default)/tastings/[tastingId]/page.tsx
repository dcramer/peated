"use client";

import TastingComments from "@peated/web/components/tastingComments";
import TastingList from "@peated/web/components/tastingList";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params: { tastingId },
}: {
  params: { tastingId: string };
}) {
  const orpc = useORPC();
  const { data: tasting } = useSuspenseQuery(
    orpc.tastings.details.queryOptions({
      input: { tasting: Number(tastingId) },
    })
  );

  return (
    <>
      <div className="mb-4">
        <TastingList values={[tasting]} noCommentAction />
      </div>
      <TastingComments tastingId={tasting.id} />
    </>
  );
}
