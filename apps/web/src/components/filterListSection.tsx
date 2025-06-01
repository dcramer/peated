"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import SidebarLink from "@peated/web/components/sidebarLink";
import { useSearch } from "@tanstack/react-router";

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
  const search = useSearch({ strict: false });

  const currentValue = value === undefined ? (search as any)[name] : value;
  const titleValue = title ?? toTitleCase(name);

  return (
    <li>
      <div className="font-semibold text-slate-200 text-sm">{titleValue}</div>
      <ul className="-mx-3 mt-2 space-y-1">
        <SidebarLink
          active={!currentValue}
          to="."
          search={(prev: any) => ({
            ...prev,
            [name]: undefined,
            cursor: undefined,
          })}
          size="small"
        >
          Any {titleValue}
        </SidebarLink>
        {options ? (
          options.map(([k, v]) => (
            <SidebarLink
              key={k}
              active={currentValue === k}
              to="."
              search={(prev: any) => ({
                ...prev,
                [name]: k,
                cursor: undefined,
              })}
              size="small"
            >
              {formatValue ? formatValue(k) : v}
            </SidebarLink>
          ))
        ) : (
          <SidebarLink
            key={currentValue}
            active
            to="."
            search={(prev: any) => ({
              ...prev,
              [name]: currentValue,
              cursor: undefined,
            })}
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
