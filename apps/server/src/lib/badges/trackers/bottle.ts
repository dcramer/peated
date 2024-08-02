import type { TastingWithRelations } from "../types";
import { Tracker } from "./base";

export class BottleTracker extends Tracker {
  track(tasting: TastingWithRelations) {
    return [{ type: "bottle" as const, id: tasting.bottle.id }];
  }
}
