export type BottleDisplayNameSource = {
  name: string;
  edition?: string | null;
  vintageYear?: number | null;
  releaseYear?: number | null;
  statedAge?: number | null;
  abv?: number | null;
  singleCask?: boolean | null;
  caskStrength?: boolean | null;
  brand: {
    name: string;
    shortName?: string | null;
  };
  series?: {
    name: string;
  } | null;
  group?: {
    name: string;
  } | null;
};

/** Requires ABV so a caller cannot drop it by reading a partial Bottle. */
export type BottleLabelSource = BottleDisplayNameSource & {
  abv: number | null;
};

export type BottleDisplayNameOptions = {
  includeBrand?: boolean;
  includeSeries?: boolean;
};

/** Short strength label, such as `43%` or `52.2%`. */
export function formatAbv(abv: number) {
  return `${abv.toFixed(1).replace(/\.0$/u, "")}%`;
}

/**
 * Bottle Presentation: a name that already shows a fact does not repeat it.
 * Matches whole words, ignoring case, so `12` is not found in `120`.
 */
export function nameIncludes(name: string, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  ).test(name);
}

// Stored Bottle names end in ` - <edition>` (formatCanonicalBottleName).
function removeStoredEdition(name: string, edition: string | null | undefined) {
  const suffix = edition ? ` - ${edition.trim()}` : null;
  return suffix &&
    name.length > suffix.length &&
    name.toLocaleLowerCase().endsWith(suffix.toLocaleLowerCase())
    ? name.slice(0, -suffix.length)
    : name;
}

function getExpressionName(bottle: BottleDisplayNameSource) {
  if (bottle.group) return bottle.group.name;

  const metadataSegments = new Set(
    [
      bottle.statedAge !== null && bottle.statedAge !== undefined
        ? `${bottle.statedAge}-year-old`
        : undefined,
      bottle.releaseYear !== null && bottle.releaseYear !== undefined
        ? `${bottle.releaseYear} Release`
        : undefined,
      bottle.vintageYear !== null && bottle.vintageYear !== undefined
        ? `${bottle.vintageYear} Vintage`
        : undefined,
      bottle.abv !== null && bottle.abv !== undefined
        ? `${bottle.abv.toFixed(1)}% ABV`
        : undefined,
      bottle.singleCask ? "Single Cask" : undefined,
      bottle.caskStrength ? "Cask Strength" : undefined,
    ]
      .filter((value): value is string => value !== undefined)
      .map((value) => value.toLocaleLowerCase()),
  );
  const titleSegments = removeStoredEdition(bottle.name, bottle.edition).split(
    " - ",
  );

  while (
    titleSegments.length > 1 &&
    metadataSegments.has(
      titleSegments[titleSegments.length - 1]!.toLocaleLowerCase(),
    )
  ) {
    titleSegments.pop();
  }

  return titleSegments.join(" - ") || bottle.name;
}

/**
 * Formats the concise marketed identity used for human-facing bottle names.
 * Whisky Identity Model: the edition is a release fact shown beside the
 * title, never inside it.
 */
export function formatBottleDisplayName(
  bottle: BottleDisplayNameSource,
  { includeBrand = true, includeSeries = true }: BottleDisplayNameOptions = {},
) {
  const expressionName = getExpressionName(bottle);
  const brandName = bottle.brand.shortName || bottle.brand.name;
  const seriesName =
    bottle.series && !nameIncludes(expressionName, bottle.series.name)
      ? bottle.series.name
      : null;

  return [
    includeBrand ? brandName : null,
    includeSeries ? seriesName : null,
    expressionName,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Releases often share a name and differ only in strength, so bottle labels
 * show ABV whenever it is known. Use this for names that are not structured,
 * such as a stored `fullName`.
 */
export function appendAbv(name: string, abv: number | null | undefined) {
  if (abv === null || abv === undefined) return name;

  const abvText = formatAbv(abv);
  return nameIncludes(name, abvText) ? name : `${name} · ${abvText}`;
}

/** Formats the bottle name with its ABV; see `appendAbv`. */
export function formatBottleLabel(
  bottle: BottleLabelSource,
  options?: BottleDisplayNameOptions,
) {
  return appendAbv(formatBottleDisplayName(bottle, options), bottle.abv);
}
