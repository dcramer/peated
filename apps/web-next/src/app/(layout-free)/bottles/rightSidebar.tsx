"use client";

import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import Button from "@peated/web/components/button";
import SidebarLink from "@peated/web/components/sidebarLink";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSearchParams } from "next/navigation";

function FilterSidebarSection({
  searchParams,
  title,
  name,
  value,
  options,
  formatValue,
}: {
  searchParams: URLSearchParams;
  title?: string;
  name: string;
  value?: string;
  options?: [string, string][];
  formatValue?: (key: string) => string;
}) {
  const currentValue = value === undefined ? searchParams.get(name) : value;
  const titleValue = title ?? toTitleCase(name);
  return (
    <li>
      <div className="text-sm font-semibold text-slate-200">{titleValue}</div>
      <ul role="list" className="-mx-3 mt-2 space-y-1">
        <SidebarLink
          active={!currentValue}
          href={{
            // pathname: location.pathname,
            search: buildQueryString(searchParams, {
              [name]: "",
              cursor: null,
            }),
          }}
          size="small"
        >
          Any {titleValue}
        </SidebarLink>
        {options ? (
          options.map(([k, v]) => (
            <SidebarLink
              key={k}
              active={currentValue === v}
              href={{
                // pathname: location.pathname,
                search: buildQueryString(searchParams, {
                  [name]: k,
                  cursor: null,
                }),
              }}
              size="small"
            >
              {formatValue ? formatValue(k) : v}
            </SidebarLink>
          ))
        ) : (
          <SidebarLink
            key={currentValue}
            active
            href={{
              // pathname: location.pathname,
              search: buildQueryString(searchParams, {
                [name]: currentValue,
                cursor: null,
              }),
            }}
            size="small"
          >
            {formatValue && currentValue
              ? formatValue(currentValue)
              : currentValue}
          </SidebarLink>
        )}
      </ul>
    </li>
  );
}

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
          searchParams={searchParams}
          name="category"
          options={CATEGORY_LIST.map((k) => [k, formatCategoryName(k)])}
        />
        <FilterSidebarSection
          searchParams={searchParams}
          name="flavorProfile"
          options={FLAVOR_PROFILES.map((k) => [k, formatFlavorProfile(k)])}
        />
        {searchParams.entity ? (
          <FilterSidebarSection
            searchParams={searchParams}
            title="Relationship"
            name="entity"
          />
        ) : null}
        {searchParams.age ? (
          <FilterSidebarSection
            searchParams={searchParams}
            title="Age"
            name="age"
            formatValue={(v) => `${v} years`}
          />
        ) : null}
        {searchParams.tag ? (
          <FilterSidebarSection
            searchParams={searchParams}
            title="Notes"
            name="tag"
          />
        ) : null}
      </ul>
    </div>
  );
}
