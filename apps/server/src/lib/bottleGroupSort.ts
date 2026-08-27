export const BOTTLE_GROUP_BOTTLE_SORT_OPTIONS = [
  "name",
  "-name",
  "created",
  "-created",
  "age",
  "-age",
  "score",
  "-score",
  "tastings",
  "-tastings",
  "releaseYear",
  "-releaseYear",
] as const;

export type BottleGroupBottleSort =
  (typeof BOTTLE_GROUP_BOTTLE_SORT_OPTIONS)[number];
