"use client";

import Table from "@peated/web/components/table";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page() {
  const [countryList] = trpc.countryList.useSuspenseQuery({
    hasBottles: true,
    sort: "-bottles",
  });

  return (
    <Table
      items={countryList.results}
      rel={countryList.rel}
      defaultSort="-bottles"
      url={(item) => `/locations/${item.slug}`}
      columns={[
        { name: "name", sort: "name", sortDefaultOrder: "asc" },
        {
          name: "totalBottles",
          title: "Bottles",
          sort: "bottles",
        },
        {
          name: "totalDistillers",
          title: "Distillers",
          sort: "distillers",
        },
      ]}
    />
  );
}
