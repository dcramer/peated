"use client";

import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";
import ReleaseTable from "./releaseTable";

export default function Page({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      bottle: Number(bottleId),
      limit: 100,
    },
  });

  const [releaseList] = trpc.bottleReleaseList.useSuspenseQuery(queryParams);

  return (
    <div className="mt-6 px-3 lg:px-0">
      <ReleaseTable bottleId={Number(bottleId)} releaseList={releaseList} />
    </div>
  );
}
