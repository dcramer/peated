"use client";

import { ENTITY_TYPE_LIST, MAJOR_COUNTRIES } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import Button from "@peated/web/components/button";
import FilterSidebarSection from "@peated/web/components/filterListSection";
import { useSearchParams } from "next/navigation";

export default function EntityListSidebar() {
  const searchParams = useSearchParams();

  return (
    <div className="mt-8 flex flex-col overflow-y-auto bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-auto flex-col gap-y-7">
        <li>
          <Button href="/addEntity" fullWidth color="highlight">
            Add Entity
          </Button>
        </li>
        <FilterSidebarSection
          name="type"
          options={ENTITY_TYPE_LIST.map((k) => [k, toTitleCase(k)])}
        />
        <FilterSidebarSection
          name="country"
          options={MAJOR_COUNTRIES.map((k) => [k, k])}
        />
        {searchParams.get("region") ? (
          <FilterSidebarSection name="region" />
        ) : null}
      </ul>
    </div>
  );
}
