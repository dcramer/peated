"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import SidebarLink from "@peated/web/components/sidebarLink";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSearchParams } from "next/navigation";

export default function FilterSidebarSection({
  title,
  name,
  value,
  options,
  formatValue,
}: {
  title?: string;
  name: string;
  value?: string;
  options?: [string, string][];
  formatValue?: (key: string) => string;
}) {
  const searchParams = useSearchParams();

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
              active={currentValue === k}
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
