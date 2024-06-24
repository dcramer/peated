"use client";

import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import Button from "@peated/web/components/button";
import FilterSidebarSection from "@peated/web/components/filterListSection";
import { useSearchParams } from "next/navigation";

export default function BottleListSidebar() {
  const searchParams = useSearchParams();
  return (
    <div className="mt-8 flex flex-col overflow-y-auto bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-auto flex-col gap-y-7">
        <li>
          <Button href="/addBottle" fullWidth color="highlight">
            Add Bottle
          </Button>
        </li>
        <FilterSidebarSection
          name="category"
          options={CATEGORY_LIST.map((k) => [k, formatCategoryName(k)])}
        />
        <FilterSidebarSection
          name="flavorProfile"
          title="Flavor Profile"
          options={FLAVOR_PROFILES.map((k) => [k, formatFlavorProfile(k)])}
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
