"use client";
import { use } from "react";

import { type ExternalSiteType } from "@peated/server/types";
import ExternalReviewTable from "@peated/web/components/admin/externalReviewTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page(props: {
  params: Promise<{ siteId: ExternalSiteType }>;
}) {
  const params = use(props.params);

  const { siteId } = params;

  const queryParams = useApiQueryParams({
    overrides: {
      site: siteId,
      sort: "name",
    },
  });

  const orpc = useORPC();
  const { data: externalReviewList } = useSuspenseQuery(
    orpc.externalReviews.list.queryOptions({
      input: queryParams,
    }),
  );

  return (
    <div>
      {externalReviewList.results.length > 0 ? (
        <ExternalReviewTable
          externalReviewList={externalReviewList.results}
          rel={externalReviewList.rel}
        />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
