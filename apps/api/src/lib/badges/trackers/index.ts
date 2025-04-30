import type { BadgeTracker } from "@peated/server/types";
import type { Tracker } from "./base";
import { BottleTracker } from "./bottle";
import { CountryTracker } from "./country";
import { EntityTracker } from "./entity";
import { RegionTracker } from "./region";

export function getTracker(type: BadgeTracker): Tracker {
  switch (type) {
    case "bottle":
      return new BottleTracker();
    case "entity":
      return new EntityTracker();
    case "region":
      return new RegionTracker();
    case "country":
      return new CountryTracker();
    default:
      throw new Error(`Invalid type: ${type}`);
  }
}
