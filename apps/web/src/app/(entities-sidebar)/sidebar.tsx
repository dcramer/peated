"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import { type EntityType } from "@peated/server/types";
import FilterSidebarSection from "@peated/web/components/filterListSection";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

export default function EntityListSidebar({ type }: { type: EntityType }) {
  const searchParams = useSearchParams();
  const orpc = useORPC();

  const { data } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: {
        onlyMajor: true,
        sort: "-bottles",
      },
    }),
  );

  const { results: majorCountryList } = data;

  return (
    <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-5 py-8">
      <h2 className="text-sm font-semibold text-white">
        Filter {toTitleCase(type)}s
      </h2>
      <ul role="list" className="mt-6 flex flex-col gap-y-5">
        <FilterSidebarSection
          name="country"
          options={majorCountryList.map((c) => [`${c.id}`, c.name])}
        />
        {searchParams.get("region") ? (
          <FilterSidebarSection name="region" />
        ) : null}
      </ul>
    </div>
  );
}
