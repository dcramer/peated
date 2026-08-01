export const BOTTLE_SCHEMA_RULES = {
  bottleIdentity:
    "Every marketed release is one independently complete Bottle. Its durable identity includes brand, bottler, distillery, expression/name, series, category, effective age, edition, ABV, vintage year, release year, single-cask, cask-strength, and other supported exact traits. The Bottle must remain correct and renderable without BottleGroup hydration.",
  exactBottleIdentity:
    "Edition, ABV, vintage year, bottling/release year, exact age, single-cask, cask-strength, and supported cask details distinguish one Bottle from related Bottles. Preserve those facts on the complete Bottle; BottleGroup assignment is automatic downstream and is never selected by the classifier.",
  yearPolicy:
    "Year fields are not interchangeable. `vintageYear` is a distillation year; `releaseYear` is a bottling or marketed release year. If the source gives a bare year, classify it from label wording, family pattern, and sibling evidence; if that evidence is weak, record the uncertainty instead of guessing the field.",
  observationPolicy:
    "Exact source facts like cask numbers, bottle numbers, outturns, exclusives, and raw maturation wording should be preserved as observations first. Promote them to canonical Bottle identity only when they are clearly part of the marketed product.",
  aliasPolicy:
    "Retailer listing aliases are evidence for the exact Bottle only when they safely identify that marketed product.",
} as const;
