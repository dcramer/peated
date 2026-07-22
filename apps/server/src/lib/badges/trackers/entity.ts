import type { BadgeTasting } from "../types";
import { Tracker } from "./base";

export class EntityTracker extends Tracker {
  track(tasting: BadgeTasting) {
    const entityList = this.getEntityList(tasting);
    const entityIds = Array.from(new Set(entityList.map((e) => e.id)));

    return entityIds.map((id) => ({ type: "entity" as const, id }));
  }
}
