"use client";

import Table from "@peated/web/components/table";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const searchParams = useSearchParams();
  const [[regionList]] = trpc.useSuspenseQueries((t) => [
    t.regionList({
      ...Object.fromEntries(searchParams.entries()),
      country: countrySlug,
      sort: "-bottles",
      limit: 100,
    }),
  ]);

  return (
    <Table
      items={regionList.results}
      rel={regionList.rel}
      defaultSort="-bottles"
      url={(item) => `/locations/${countrySlug}/regions/${item.slug}`}
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
