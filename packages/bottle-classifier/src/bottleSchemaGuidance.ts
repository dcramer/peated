export const BOTTLE_SCHEMA_RULES = {
  bottleIdentity:
    "Every marketed release is one complete Bottle. Record its brand, bottler, distillery, name, series, category, age, edition, ABV, distillation year, bottling year, release year, single-cask and cask-strength details, and other supported Bottle details. The Bottle must remain correct and understandable without reading its BottleGroup.",
  exactBottleIdentity:
    "Edition, ABV, distillation year, release year, stated age, single-cask and cask-strength details, finish wording, and cask codes can distinguish related Bottles. A bottling year distinguishes Bottles only when the producer markets that bottling as a separate release. Keep the complete edition name, such as `2022 Edition` or `Batch 24`; general limited-release wording does not replace the stable expression. A printed batch or lot code is an edition only when evidence shows that the producer markets it as a separate release. Keep stated cask type, size, and fill values as extra details, but never use those three fields alone to select, reject, create, or suggest a Bottle change. The server assigns the BottleGroup; the classifier never selects it.",
  yearPolicy:
    "The year fields mean different things. `vintageYear` is the distillation year. `bottlingYear` is the year the whisky was bottled. `releaseYear` is the year the release became available. A different bottling year alone does not prove that it is a different Bottle. If a source gives a year without explaining it, use the label wording and related Bottles to decide. If the meaning is still unclear, leave the year fields empty. Never calculate `statedAge` from year fields. Set it only when the product evidence states the age.",
  observationPolicy:
    "Use `observation` for a source cask number, barrel number, or selector name when it does not identify the marketed Bottle. A source bottle number is evidence only. Do not put it in `edition` unless evidence identifies it as a marketed release descriptor.",
  aliasPolicy:
    "Retailer listing aliases are evidence for the exact Bottle only when they safely identify that marketed product. Removing retailer, package, condition, or other source noise does not make the original label a reusable global alias.",
} as const;
