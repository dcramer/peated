export const BOTTLE_SCHEMA_RULES = {
  bottleIdentity:
    "Bottle identity is the stable parent product and the default object for tasting, search, and collection. Brand, bottler, distillery, expression/name, series, category, and an age statement that is stable across the product belong here. When only one marketed form is known, the bottle may temporarily carry release-like traits until a reusable child release is warranted; once sibling evidence exists, those varying traits belong on child releases.",
  releaseIdentity:
    "Release identity is optional and only exists under a bottle when the differentiator should aggregate across users, searches, prices, and stats. Edition, ABV, vintage year, bottling/release year, release-specific age, single-cask, cask-strength, and cask details belong here when they distinguish siblings of a stable parent.",
  yearPolicy:
    "Year fields are not interchangeable. `vintageYear` is a distillation year; `releaseYear` is a bottling or marketed release year. If the source gives a bare year, classify it from label wording, family pattern, and sibling evidence; if that evidence is weak, record the uncertainty instead of forcing a release.",
  observationPolicy:
    "Exact source facts like cask numbers, bottle numbers, outturns, exclusives, and raw maturation wording should be preserved as observations first. Promote them to canonical release identity only when they are clearly part of the marketed release.",
  aliasPolicy:
    "Retailer listing aliases are bottle-level evidence unless they exactly match a canonical release alias.",
} as const;
