import { notEmpty } from "../../filter";
import type { TastingWithRelations } from "../types";
import { Tracker } from "./base";

export class CountryTracker extends Tracker {
  track(tasting: TastingWithRelations) {
    const entityList = this.getEntityList(tasting);
    const countryIds = Array.from(
      new Set(entityList.map((e) => e.countryId).filter(notEmpty)),
    );

    return countryIds.map((id) => ({ type: "country" as const, id }));
  }
}
