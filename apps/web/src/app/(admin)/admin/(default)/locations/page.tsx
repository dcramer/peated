"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Table from "@peated/web/components/table";
import { trpc } from "@peated/web/lib/trpc/client";
import { useSearchParams } from "next/navigation";

export default function Page() {
  const searchParams = useSearchParams();
  const [countryList] = trpc.countryList.useSuspenseQuery({
    ...Object.fromEntries(searchParams.entries()),
  });

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Locations",
            href: "/admin/locations",
            current: true,
          },
        ]}
      />

      <Table
        items={countryList.results}
        rel={countryList.rel}
        defaultSort="-created"
        url={(item) => `/admin/locations/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
        withSearch
      />
    </div>
  );
}
