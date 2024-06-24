"use client";

import { MAJOR_COUNTRIES } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/src/lib/strings";
import { type EntityType } from "@peated/server/types";
import Button from "@peated/web/components/button";
import FilterSidebarSection from "@peated/web/components/filterListSection";
import { useSearchParams } from "next/navigation";

export default function EntityListSidebar({ type }: { type: EntityType }) {
  const searchParams = useSearchParams();

  return (
    <div className="mt-8 flex flex-col overflow-y-auto bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-auto flex-col gap-y-7">
        <li>
          <Button href={`/addEntity?type=${type}`} fullWidth color="highlight">
            Add {toTitleCase(type)}
          </Button>
        </li>

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
