"use client";
import { use } from "react";

import { type ExternalSiteKey } from "@peated/server/types";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import StorePriceTable from "@peated/web/components/admin/storePriceTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page(props: {
  params: Promise<{ siteId: ExternalSiteKey }>;
}) {
  const { siteId } = use(props.params);
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: { site: siteId },
  });
  const orpc = useORPC();
  const { data: priceList } = useSuspenseQuery(
    orpc.prices.list.queryOptions({
      input: { ...queryParams, site: siteId },
    }),
  );

  return priceList.results.length > 0 ? (
    <StorePriceTable priceList={priceList.results} rel={priceList.rel} />
  ) : (
    <EmptyActivity>No prices have been collected yet.</EmptyActivity>
  );
}
