export const BOTTLE_SCHEMA_RULES = {
  bottleIdentity:
    "Bottle identity is the stable parent product and the default object for tasting, search, and collection. Brand, bottler, distillery, expression/name, series, and category belong here. When only one marketed form is known, the bottle may temporarily carry release-like traits until a reusable child release is warranted.",
  releaseIdentity:
    "Release identity is optional and only exists under a bottle when the differentiator should aggregate across users, searches, prices, and stats. Edition, ABV, years, single-cask, cask-strength, and cask details belong here.",
  observationPolicy:
    "Exact source facts like cask numbers, bottle numbers, outturns, exclusives, and raw maturation wording should be preserved as observations first. Promote them to canonical release identity only when they are clearly part of the marketed release.",
  aliasPolicy:
    "Retailer listing aliases are bottle-level evidence unless they exactly match a canonical release alias.",
} as const;
