"use client";

import { CASK_TYPES, CATEGORY_LIST } from "@peated/server/constants";
import { formatCategoryName } from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import FilterSidebarSection from "@peated/web/components/filterListSection";
import { useSearchParams } from "next/navigation";

export default function BottleListSidebar() {
  const searchParams = useSearchParams();
  return (
    <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-5 py-8">
      <h2 className="text-sm font-semibold text-white">Filter bottles</h2>
      <ul role="list" className="mt-6 flex flex-col gap-y-5">
        <FilterSidebarSection
          name="minRating"
          title="Rating"
          allLabel="All bottles"
          options={[
            ["2", "Savor"],
            ["1", "Sip or Better"],
            ["-1", "Any Rating"],
          ]}
        />
        <FilterSidebarSection
          name="category"
          options={CATEGORY_LIST.map((k) => [k, formatCategoryName(k)])}
        />
        <FilterSidebarSection
          title="Cask"
          name="caskType"
          options={CASK_TYPES.map((k) => [k.id, toTitleCase(k.id)])}
        />
        {searchParams.get("entity") ? (
          <FilterSidebarSection title="Relationship" name="entity" />
        ) : null}
        {searchParams.get("age") ? (
          <FilterSidebarSection
            title="Age"
            name="age"
            formatValue={(v) => `${v} years`}
          />
        ) : null}
        {searchParams.get("tag") ? (
          <FilterSidebarSection title="Notes" name="tag" />
        ) : null}
      </ul>
    </div>
  );
}
