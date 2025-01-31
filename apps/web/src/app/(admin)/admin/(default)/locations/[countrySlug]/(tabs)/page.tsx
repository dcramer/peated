"use client";
import { use } from "react";

import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const params = use(props.params);

  const { countrySlug } = params;

  const queryParams = useApiQueryParams({
    defaults: {
      sort: "-created",
    },
    numericFields: ["cursor", "limit"],
    overrides: {
      country: countrySlug,
    },
  });

  const [regionList] = trpc.regionList.useSuspenseQuery(queryParams);
  return (
    <div>
      <Table
        items={regionList.results}
        rel={regionList.rel}
        defaultSort="-created"
        url={(item) => `/admin/locations/${countrySlug}/regions/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
      />
    </div>
  );
}
