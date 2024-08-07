import { TSVector } from "../db/columns";
import type { NewBottle, NewBottleAlias, NewEntity } from "../db/schema";
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
    values.push(
      new TSVector(`${brand.name} ${bottle.name} ${bottle.edition || ""}`, "B"),
    );
  if (bottle.edition)
    values.push(new TSVector(`${bottle.name} ${bottle.edition}`, "B"));
  else values.push(new TSVector(bottle.name, "B"));

  if (bottle.category)
    values.push(new TSVector(formatCategoryName(bottle.category), "C"));
  if (bottle.vintageYear)
    values.push(new TSVector(`${bottle.vintageYear} Vintage`, "B"));
  if (bottle.releaseYear)
    values.push(new TSVector(`${bottle.releaseYear} Release`, "B"));
  if (bottler) values.push(new TSVector(bottler.name, "C"));
  aliasList
    ?.filter((a) => a.name !== bottle.fullName)
    .forEach((a) => values.push(new TSVector(a.name, "A")));
  distillerList?.forEach((a) => values.push(new TSVector(a.name, "B")));
  return values;
}
