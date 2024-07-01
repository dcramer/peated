import { TSVector } from "../db/columns";
import type {
  NewBottle,
  NewBottleAlias,
  NewEntity,
  NewEntityAlias,
} from "../db/schema";
import { notEmpty } from "./filter";

function uniq<T>(values: T[]): T[] {
  const seen = new Set();
  return values.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

export function buildEntitySearchVector(
  entity: NewEntity,
  aliasList?: NewEntityAlias[],
) {
  const values: TSVector[] = [
    new TSVector(entity.name, "A"),
    ...(entity.shortName ? [new TSVector(entity.shortName, "B")] : []),
  ];
  aliasList?.forEach((a) => values.push(new TSVector(a.name, "A")));
  return uniq(values.filter(notEmpty)).join(" ");
}

export function buildBottleSearchVector(
  bottle: NewBottle,
  brand: NewEntity,
  aliasList?: NewBottleAlias[],
  bottler?: NewEntity,
  distillerList?: NewEntity[],
) {
  const values: TSVector[] = [
    new TSVector(bottle.fullName, "A"),
    new TSVector(bottle.name, "B"),
    new TSVector(brand.name, "B"),
  ];
  if (bottler) values.push(new TSVector(bottler.name, "C"));
  aliasList?.forEach((a) => values.push(new TSVector(a.name, "A")));
  distillerList?.forEach((a) => values.push(new TSVector(a.name, "B")));
  return uniq(values.filter(notEmpty)).join(" ");
}
