"use client";
import { use } from "react";

import { type ExternalSiteKey } from "@peated/server/types";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import ReviewTable from "@peated/web/components/admin/reviewTable.stylex";
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
  const { data: reviews } = useSuspenseQuery(
    orpc.externalReviews.list.queryOptions({
      input: queryParams,
    }),
  );
  return reviews.results.length > 0 ? (
    <ReviewTable reviews={reviews.results} rel={reviews.rel} />
  ) : (
    <EmptyActivity>This site has no reviews yet.</EmptyActivity>
  );
}
