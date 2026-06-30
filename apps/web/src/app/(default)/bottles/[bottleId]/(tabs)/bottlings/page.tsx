"use client";
import { use } from "react";

import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import ReleaseTable from "../releases/releaseTable";

export default function Page(props: { params: Promise<{ bottleId: string }> }) {
  const params = use(props.params);

  const { bottleId } = params;

  const orpc = useORPC();
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      bottle: Number(bottleId),
      limit: 100,
    },
  });

  const { data: releaseList } = useSuspenseQuery(
    orpc.bottleReleases.list.queryOptions({
      input: queryParams,
    }),
  );

  return (
    <div className="mt-6 px-3 lg:px-0">
      <ReleaseTable bottleId={Number(bottleId)} releaseList={releaseList} />
    </div>
  );
}
