"use client";

import type { ExternalSiteType } from "@peated/server/types";
import ReviewTable from "@peated/web/components/admin/reviewTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params: { siteId },
}: {
  params: { siteId: ExternalSiteType };
}) {
  const queryParams = useApiQueryParams({
    overrides: {
      site: siteId,
    },
  });

  const orpc = useORPC();
  const { data: reviewList } = useSuspenseQuery(
    orpc.reviews.list.queryOptions({
      input: queryParams,
    })
  );

  return (
    <div>
      {reviewList.results.length > 0 ? (
        <ReviewTable reviewList={reviewList.results} rel={reviewList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
