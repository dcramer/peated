"use client";

import { XMarkIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import { buildQueryString } from "@peated/web/lib/urls";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function FilterSidebarSection({
  title,
  name,
  value,
  options,
  formatValue,
  allLabel,
}: {
  title?: string;
  name: string;
  value?: string;
  options?: [string, string][];
  formatValue?: (key: string) => string;
  allLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentValue = value === undefined ? searchParams.get(name) : value;
  const titleValue = title ?? toTitleCase(name);
  const setFilter = (nextValue: string) => {
    const query = buildQueryString(searchParams, {
      [name]: nextValue,
      cursor: null,
    });
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  if (!options) {
    if (!currentValue) return null;

    return (
      <li>
        <div className="text-muted text-xs font-semibold uppercase tracking-wide">
          {titleValue}
        </div>
        <button
          type="button"
          onClick={() => setFilter("")}
          className="focus-visible:outline-highlight mt-2 flex w-full items-center justify-between gap-x-2 rounded bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2"
        >
          <span className="truncate">
            {formatValue ? formatValue(currentValue) : currentValue}
          </span>
          <XMarkIcon className="text-muted h-4 w-4 shrink-0" />
        </button>
      </li>
    );
  }

  return (
    <li>
      <label>
        <span className="text-muted text-xs font-semibold uppercase tracking-wide">
          {titleValue}
        </span>
        <select
          value={currentValue ?? ""}
          onChange={(event) => setFilter(event.currentTarget.value)}
          className="focus:border-highlight focus:ring-highlight mt-2 block w-full rounded border-slate-700 bg-slate-900 py-2 pl-3 pr-8 text-sm text-slate-100"
        >
          <option value="">
            {allLabel ?? `Any ${titleValue.toLowerCase()}`}
          </option>
          {options.map(([key, label]) => (
            <option key={key} value={key}>
              {formatValue ? formatValue(key) : label}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}
