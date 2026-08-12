export const BOTTLE_SCHEMA_RULES = {
  bottleIdentity:
    "Every marketed release is one independently complete Bottle. Its durable identity includes brand, bottler, distillery, expression/name, series, category, effective age, edition, ABV, vintage year, release year, single-cask, cask-strength, and other supported exact traits. The Bottle must remain correct and renderable without BottleGroup hydration.",
  exactBottleIdentity:
    "Edition, ABV, vintage year, marketed release year, exact age, single-cask, cask-strength, marketed finish wording, and exact cask codes can distinguish one Bottle from related Bottles. Preserve explicit cask type, size, and fill values as optional metadata, but never use those three fields alone to select, reject, create, or suggest a Bottle change. BottleGroup assignment is automatic downstream and is never selected by the classifier.",
  yearPolicy:
    "Year fields are not interchangeable. `vintageYear` is a distillation year. `releaseYear` is a marketed release year. If the source gives a bare year, classify it from label wording, family pattern, and sibling evidence. If that evidence is weak, record the uncertainty instead of guessing the field. Never calculate `statedAge` from vintage and release dates. Set it only when product evidence states the age.",
  observationPolicy:
    "Use `observation` for a source cask number, barrel number, or selector name when it does not identify the marketed Bottle. A source bottle number is evidence only. Do not put it in `edition` unless evidence identifies it as a marketed release descriptor.",
  aliasPolicy:
    "Retailer listing aliases are evidence for the exact Bottle only when they safely identify that marketed product. Removing retailer, package, condition, or other source noise does not make the original label a reusable global alias.",
} as const;
