"use client";
import { use } from "react";

import { type ExternalSiteKey } from "@peated/server/types";
import { AdminSection } from "@peated/web/components/admin/adminContent.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import ExternalReviewTable from "@peated/web/components/admin/externalReviewTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page(props: {
  params: Promise<{ siteId: ExternalSiteKey }>;
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
    <AdminSection
      title="Collected reviews"
      description="Review bottle matches and scores collected from this site."
    >
      {externalReviewList.results.length > 0 ? (
        <ExternalReviewTable
          externalReviewList={externalReviewList.results}
          rel={externalReviewList.rel}
        />
      ) : (
        <EmptyActivity>No reviews have been collected yet.</EmptyActivity>
      )}
    </AdminSection>
  );
}
