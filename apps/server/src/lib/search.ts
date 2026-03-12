import { TSVector } from "../db/columns";
import type {
  NewBottle,
  NewBottleAlias,
  NewBottleRelease,
  NewBottleSeries,
  NewEntity,
} from "../db/schema";
import { formatCategoryName } from "./format";

const CASK_STRENGTH_SEARCH_TERMS =
  "cask strength barrel strength barrel proof full proof natural strength";
const SINGLE_CASK_SEARCH_TERMS = "single cask single barrel";

function formatSearchAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) {
    return null;
  }

  return `${abv.toFixed(1)}% ABV`;
}

function formatSearchEnum(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/_/g, " ");
}

export function buildEntitySearchVector(
  entity: NewEntity,
  aliasList?: { name: string }[],
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(entity.name, "A"),
    ...(entity.shortName ? [new TSVector(entity.shortName, "A")] : []),
  ];
  aliasList
    ?.filter((a) => a.name !== entity.name)
    .forEach((a) => values.push(new TSVector(a.name, "B")));
  return values;
}

export function buildBottleSearchVector(
  bottle: NewBottle,
  brand: NewEntity,
  aliasList?: NewBottleAlias[],
  bottler?: NewEntity,
  distillerList?: NewEntity[],
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(bottle.fullName, "A"),
    new TSVector(brand.name, "B"),
  ];
  if (brand.shortName)
    values.push(new TSVector(`${brand.shortName} ${bottle.name}`, "B"));

  if (bottle.category)
    values.push(new TSVector(formatCategoryName(bottle.category), "C"));
  if (bottle.edition) values.push(new TSVector(bottle.edition, "A"));
  if (bottle.statedAge)
    values.push(new TSVector(`${bottle.statedAge}-year-old`, "B"));
  if (bottle.caskType)
    values.push(new TSVector(formatSearchEnum(bottle.caskType)!, "B"));
  if (bottle.caskStrength)
    values.push(new TSVector(CASK_STRENGTH_SEARCH_TERMS, "B"));
  if (bottle.singleCask)
    values.push(new TSVector(SINGLE_CASK_SEARCH_TERMS, "B"));
  if (bottle.vintageYear)
    values.push(new TSVector(`${bottle.vintageYear} vintage`, "B"));
  if (bottle.releaseYear)
    values.push(new TSVector(`${bottle.releaseYear} release`, "B"));
  if (bottle.abv) values.push(new TSVector(formatSearchAbv(bottle.abv)!, "B"));
  if (bottler) values.push(new TSVector(bottler.name, "C"));
  aliasList
    ?.filter((a) => a.name !== bottle.fullName)
    .forEach((a) => values.push(new TSVector(a.name, "A")));
  distillerList?.forEach((a) => values.push(new TSVector(a.name, "B")));
  return values;
}

export function buildBottleReleaseSearchVector(
  bottle: NewBottle,
  release: NewBottleRelease,
  brand: NewEntity,
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(bottle.fullName, "A"),
    new TSVector(brand.name, "B"),
  ];
  if (brand.shortName)
    values.push(new TSVector(`${brand.shortName} ${bottle.name}`, "B"));

  if (release.edition) {
    values.push(
      new TSVector(`${brand.name} ${bottle.name} ${release.edition}`, "A"),
    );
    if (brand.shortName)
      values.push(
        new TSVector(
          `${brand.shortName} ${bottle.name} ${release.edition}`,
          "A",
        ),
      );
  }

  if (bottle.category)
    values.push(new TSVector(formatCategoryName(bottle.category), "C"));
  if (release.vintageYear)
    values.push(new TSVector(`${release.vintageYear} Vintage`, "B"));
  if (release.releaseYear)
    values.push(new TSVector(`${release.releaseYear} Release`, "B"));
  return values;
}

export function buildBottleSeriesSearchVector(
  series: NewBottleSeries,
  brand: NewEntity,
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(series.fullName, "A"),
    new TSVector(brand.name, "C"),
  ];
  if (brand.shortName)
    values.push(new TSVector(`${brand.shortName} ${series.name}`, "B"));
  return values;
}
