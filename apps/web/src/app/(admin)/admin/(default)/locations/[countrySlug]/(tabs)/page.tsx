"use client";

import Table from "@peated/web/components/table";
import { trpc } from "@peated/web/lib/trpc/client";
import { useSearchParams } from "next/navigation";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const searchParams = useSearchParams();
  const [regionList] = trpc.regionList.useSuspenseQuery({
    country: countrySlug,
    ...Object.fromEntries(searchParams.entries()),
  });
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
