import type { Bottle } from "./types";

export function getBottleDisplayName(bottle: Bottle): string {
  return `${bottle.brand?.name || bottle.producer?.name} ${bottle.name}`;
}
