"use client";
import { use } from "react";

import { type ExternalSiteType } from "@peated/server/types";
import ReviewTable from "@peated/web/components/admin/reviewTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page(props: {
  params: Promise<{ siteId: ExternalSiteType }>;
}) {
  const params = use(props.params);

  const { siteId } = params;

  const queryParams = useApiQueryParams({
    overrides: {
      site: siteId,
    },
  });

  const [reviewList] = trpc.reviewList.useSuspenseQuery(queryParams);
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
