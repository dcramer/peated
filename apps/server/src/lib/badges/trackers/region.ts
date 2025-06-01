import { notEmpty } from "../../filter";
import type { TastingWithRelations } from "../types";
import { Tracker } from "./base";

export class RegionTracker extends Tracker {
  track(tasting: TastingWithRelations) {
    const entityList = this.getEntityList(tasting);
    const regionIds = Array.from(
      new Set(entityList.map((e) => e.regionId).filter(notEmpty))
    );

    return regionIds.map((id) => ({ type: "region" as const, id }));
  }
}
