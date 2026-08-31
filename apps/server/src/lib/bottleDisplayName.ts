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

export type BottleDisplayNameOptions = {
  includeBrand?: boolean;
};

function includesIdentityText(value: string, candidate: string) {
  return value.toLocaleLowerCase().includes(candidate.toLocaleLowerCase());
}

export function isBatchEdition(edition: string | null | undefined) {
  return edition
    ? /^batch(?:\s+(?:no\.?|number))?\s+\S/iu.test(edition)
    : false;
}

/** Returns an exact release fact that belongs beside, rather than inside, the title. */
export function getBottleReleaseMetadata(
  bottle: Pick<
    BottleDisplayNameSource,
    "edition" | "releaseYear" | "vintageYear"
  >,
) {
  if (bottle.edition && isBatchEdition(bottle.edition)) return bottle.edition;
  if (bottle.edition) return null;
  if (bottle.vintageYear !== null && bottle.vintageYear !== undefined) {
    return `${bottle.vintageYear} vintage`;
  }
  if (bottle.releaseYear !== null && bottle.releaseYear !== undefined) {
    return `${bottle.releaseYear} release`;
  }
  return null;
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
  const titleSegments = bottle.name.split(" - ");

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

function getReleaseName(bottle: BottleDisplayNameSource) {
  const expressionName = getExpressionName(bottle);

  if (bottle.edition && !isBatchEdition(bottle.edition)) {
    return includesIdentityText(expressionName, bottle.edition)
      ? expressionName
      : `${expressionName} - ${bottle.edition}`;
  }

  return expressionName;
}

/** Formats the concise marketed identity used for human-facing bottle names. */
export function formatBottleDisplayName(
  bottle: BottleDisplayNameSource,
  { includeBrand = true }: BottleDisplayNameOptions = {},
) {
  const expressionName = getReleaseName(bottle);
  const brandName = bottle.brand.shortName || bottle.brand.name;
  const seriesName =
    bottle.series && !includesIdentityText(expressionName, bottle.series.name)
      ? bottle.series.name
      : null;

  return [includeBrand ? brandName : null, seriesName, expressionName]
    .filter(Boolean)
    .join(" ");
}
