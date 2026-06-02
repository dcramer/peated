"use client";

import Table from "@peated/web/components/table";
import TableSkeleton from "@peated/web/components/tableSkeleton";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";

function AllRegionsTable() {
  const orpc = useORPC();
  const { data: countryList } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: {
        hasBottles: true,
        sort: "-bottles",
      },
    }),
  );

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

export default function Page() {
  return (
    <Suspense fallback={<TableSkeleton rows={20} columns={3} />}>
      <AllRegionsTable />
    </Suspense>
  );
}
