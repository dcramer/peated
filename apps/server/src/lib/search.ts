import { TSVector } from "../db/columns";
import type {
  NewBottle,
  NewBottleAlias,
  NewBottleRelease,
  NewBottleSeries,
  NewEntity,
} from "../db/schema";
import { formatCategoryName } from "./format";

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
