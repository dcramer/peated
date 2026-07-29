import { notEmpty } from "../../filter";
import type { BadgeTasting } from "../types";
import { Tracker } from "./base";

export class RegionTracker extends Tracker {
  track(tasting: BadgeTasting) {
    const entityList = this.getEntityList(tasting);
    const regionIds = Array.from(
      new Set(entityList.map((e) => e.regionId).filter(notEmpty)),
    );

    return regionIds.map((id) => ({ type: "region" as const, id }));
  }
}
