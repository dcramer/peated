export type LocationMap =
  | { kind: "country" | "state"; slug: string }
  | { kind: "region"; slug: "scotland/islay" };

/** Selects artwork for the region itself, never its parent country. */
export function getRegionMap(
  countrySlug: string,
  regionSlug: string,
): LocationMap | null {
  if (countrySlug === "united-states") {
    return { kind: "state", slug: regionSlug };
  }
  if (countrySlug === "scotland" && regionSlug === "islay") {
    return { kind: "region", slug: "scotland/islay" };
  }
  return null;
}
