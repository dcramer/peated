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
  const values: (string | null | undefined)[] = [
    entity.name,
    entity.shortName ?? null,
  ];
  aliasList?.forEach((a) => values.push(a.name));
  return uniq(values.filter(notEmpty)).join(" ");
}

export function buildBottleSearchVector(
  bottle: NewBottle,
  brand: NewEntity,
  aliasList?: NewBottleAlias[],
  bottler?: NewEntity,
  distillerList?: NewEntity[],
) {
  const values: (string | null | undefined)[] = [bottle.name, brand.name];
  if (bottler) values.push(bottler.name);
  aliasList?.forEach((a) => values.push(a.name));
  distillerList?.forEach((a) => values.push(a.name));
  return uniq(values.filter(notEmpty)).join(" ");
}
