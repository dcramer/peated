"use client";

import {
  CASK_TYPES,
  CATEGORY_LIST,
  FLAVOR_PROFILES,
} from "@peated/server/constants";
import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import Button from "@peated/web/components/button";
import FilterSidebarSection from "@peated/web/components/filterListSection";
import { useSearch } from "@tanstack/react-router";

export default function BottleListSidebar() {
  const search = useSearch({ strict: false });
  return (
    <div className="mt-8 flex flex-col overflow-y-auto bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-auto flex-col gap-y-7">
        <li>
          <Button
            href={`/addBottle?returnTo=${encodeURIComponent("/bottles")}`}
            fullWidth
            color="highlight"
          >
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
        <FilterSidebarSection
          title="Cask"
          name="caskType"
          options={CASK_TYPES.map((k) => [k.id, toTitleCase(k.id)])}
        />
        {(search as any).entity ? (
          <FilterSidebarSection title="Relationship" name="entity" />
        ) : null}
        {(search as any).age ? (
          <FilterSidebarSection
            title="Age"
            name="age"
            formatValue={(v) => `${v} years`}
          />
        ) : null}
        {(search as any).tag ? (
          <FilterSidebarSection title="Notes" name="tag" />
        ) : null}
      </ul>
    </div>
  );
}
