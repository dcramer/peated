import { toTitleCase } from "@peated/server/lib/strings";

type BottleLabelSource = {
  name: string;
  edition?: string | null;
  vintageYear?: number | null;
  releaseYear?: number | null;
  statedAge?: number | null;
  abv?: number | null;
  singleCask?: boolean | null;
  caskStrength?: boolean | null;
  caskFill?: string | null;
  caskType?: string | null;
  caskSize?: string | null;
  brand: {
    name: string;
    shortName?: string | null;
  };
  series?: {
    name: string;
  } | null;
  group?: {
    name: string;
  };
};

function includesIdentityText(value: string, candidate: string) {
  return value.toLocaleLowerCase().includes(candidate.toLocaleLowerCase());
}

export function getBottleExpressionName(bottle: BottleLabelSource) {
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
      bottle.caskType ? `${toTitleCase(bottle.caskType)} Cask` : undefined,
      bottle.caskSize ? toTitleCase(bottle.caskSize) : undefined,
      bottle.caskFill
        ? bottle.caskFill === "other"
          ? "Other Fill"
          : toTitleCase(bottle.caskFill)
        : undefined,
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

export function getBottleContextLabel(bottle: BottleLabelSource) {
  const brandName = bottle.brand.shortName || bottle.brand.name;
  const expressionName = getBottleExpressionName(bottle);
  const seriesName =
    bottle.series && !includesIdentityText(expressionName, bottle.series.name)
      ? bottle.series.name
      : null;

  return [brandName, seriesName, expressionName].filter(Boolean).join(" ");
}

export function getBottlePlainTextIdentity(bottle: BottleLabelSource) {
  const contextLabel = getBottleContextLabel(bottle);

  if (bottle.edition) {
    return includesIdentityText(contextLabel, bottle.edition)
      ? contextLabel
      : `${contextLabel} - ${bottle.edition}`;
  }
  if (bottle.vintageYear !== null && bottle.vintageYear !== undefined) {
    return `${contextLabel} - ${bottle.vintageYear} Vintage`;
  }
  if (bottle.releaseYear !== null && bottle.releaseYear !== undefined) {
    return `${contextLabel} - ${bottle.releaseYear} Release`;
  }

  return contextLabel;
}
