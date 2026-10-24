"use client";

import type { AgeStats } from "@peated/server/schemas";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import type { MemberListFilterGroup } from "@peated/web/components/pages/memberListFilters.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";

/**
 * URL state for one member's Tastings or Library tab. The URL owns filters,
 * search, sort, view, and page. Controls read `displayed`, which moves to the
 * next URL as soon as a member picks something; queries read the committed
 * `searchParams`, so results stay until the next page arrives.
 *
 * `filterParams` lists the filters "Clear filters" removes and the Filters
 * button counts; display choices such as `sort` and `view` stay out of it.
 */
export function useProfileListParams(filterParams: readonly string[]) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
  const displayed = new URLSearchParams(displayedParams);

  function navigate(next: URLSearchParams) {
    const nextQuery = next.toString();
    startTransition(() => {
      setDisplayedParams(nextQuery);
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    });
  }

  /**
   * Sets one parameter, or removes it when `value` is empty, and also removes
   * `alsoClear`. Anything but a view change returns to the first page.
   */
  function setParam(
    name: string,
    value: string,
    alsoClear: readonly string[] = [],
  ) {
    const next = new URLSearchParams(displayedParams);
    if (name !== "view") next.delete("cursor");
    alsoClear.forEach((param) => next.delete(param));
    if (value) next.set(name, value);
    else next.delete(name);
    navigate(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(displayedParams);
    ["cursor", ...filterParams].forEach((param) => next.delete(param));
    navigate(next);
  }

  return {
    activeFilterCount: filterParams.filter((param) => displayed.get(param))
      .length,
    clearFilters,
    displayed,
    isNavigating,
    pathname,
    searchParams,
    setParam,
  };
}

/**
 * The rail group for a brand or producer picked from search. The page
 * prefetches its name, so "Loading…" shows only after a pick in the browser.
 */
export function useEntityFilterGroup(
  entity: number | undefined,
): MemberListFilterGroup | undefined {
  const orpc = useORPC();
  const entityQuery = useQuery({
    ...orpc.entities.details.queryOptions({ input: { entity: entity ?? 0 } }),
    enabled: entity !== undefined,
  });
  if (entity === undefined) return undefined;

  // A brand or producer picked from search matches any role it has.
  return {
    filters: [
      {
        label: entityQuery.data?.name ?? "Loading…",
        selected: true,
        value: String(entity),
      },
    ],
    label: "Brand or producer",
    name: "entity",
  };
}

/**
 * The Age group, from the same age ranges the `age` filter uses, with the
 * median and oldest stated age above it.
 */
export function getAgeFilterGroup(
  age: AgeStats,
  selected: string | null,
): MemberListFilterGroup {
  return {
    filters: age.buckets.map((bucket) => ({
      count: bucket.count,
      label: bucket.id === "unstated" ? "No age stated" : bucket.label,
      selected: selected === bucket.id,
      value: bucket.id,
    })),
    label: "Age",
    name: "age",
    summary:
      age.median !== null && age.oldest !== null
        ? `Median ${formatYears(age.median)} · oldest ${formatYears(age.oldest)}`
        : undefined,
  };
}

/** A group of brands or producers ranked by how many records name them. */
export function getEntityCountGroup({
  items,
  label,
  name,
  selected,
}: {
  items: readonly { count: number; id: number; name: string }[];
  label: string;
  name: string;
  selected: string | null;
}): MemberListFilterGroup {
  return {
    filters: items.map((item) => ({
      count: item.count,
      label: item.name,
      selected: selected === String(item.id),
      value: String(item.id),
    })),
    label,
    name,
  };
}

function formatYears(value: number) {
  return `${value.toLocaleString("en-US")} ${value === 1 ? "year" : "years"}`;
}
