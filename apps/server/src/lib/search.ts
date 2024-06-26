import { TSVector } from "../db/columns";
import type {
  NewBottle,
  NewBottleAlias,
  NewEntity,
  NewEntityAlias,
} from "../db/schema";

export function buildEntitySearchVector(
  entity: NewEntity,
  aliasList?: NewEntityAlias[],
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(entity.name, "A"),
    ...(entity.shortName ? [new TSVector(entity.shortName, "B")] : []),
  ];
  aliasList?.forEach((a) => values.push(new TSVector(a.name, "A")));
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
    new TSVector(bottle.name, "B"),
    new TSVector(brand.name, "B"),
  ];
  if (bottler) values.push(new TSVector(bottler.name, "C"));
  aliasList?.forEach((a) => values.push(new TSVector(a.name, "A")));
  distillerList?.forEach((a) => values.push(new TSVector(a.name, "B")));
  return values;
}
