export const LOCATION_BOTTLE_DEFAULT_SORT = "-release";

export const LOCATION_BOTTLE_QUERY_FIELDS = ["cursor", "sort"] as const;

export const LOCATION_BOTTLE_SORT_OPTIONS = [
  { label: "Newest release", value: "-release" },
  { label: "Most tasted", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Bottle name", value: "name" },
  { label: "Oldest age", value: "-age" },
] as const;
