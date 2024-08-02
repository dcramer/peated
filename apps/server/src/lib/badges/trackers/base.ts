import type { TastingWithRelations, TrackedObject } from "../types";

export abstract class Tracker {
  abstract track(tasting: TastingWithRelations): TrackedObject[];

  getEntityList(tasting: TastingWithRelations) {
    const { bottle } = tasting;
    const resultIds = new Set([bottle.brand.id]);
    const results = [bottle.brand];
    if (bottle.bottler && !resultIds.has(bottle.bottler.id)) {
      results.push(bottle.bottler);
      resultIds.add(bottle.bottler.id);
    }

    for (const { distiller } of bottle.bottlesToDistillers) {
      if (!resultIds.has(distiller.id)) {
        results.push(distiller);
        resultIds.add(distiller.id);
      }
    }

    return results;
  }
}
