"use client";

import { ExternalSiteKeySchema } from "@peated/server/schemas";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";
import CatalogListingTable from "./catalogListingTable";

export default function Page(props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(props.params);
  const site = ExternalSiteKeySchema.parse(siteId);
  const queryParams = useApiQueryParams({
    fields: ["query", "cursor", "limit"],
    numericFields: ["cursor", "limit"],
  });
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.externalSites.catalogListings.list.queryOptions({
      input: { ...queryParams, site },
    }),
  );

  return data.results.length > 0 ? (
    <CatalogListingTable listings={data.results} rel={data.rel} />
  ) : (
    <EmptyActivity>
      No products have been collected from this catalog yet.
    </EmptyActivity>
  );
}
