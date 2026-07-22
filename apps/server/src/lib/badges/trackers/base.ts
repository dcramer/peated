import type {
  BadgeIdentityEntity,
  BadgeTasting,
  TrackedObject,
} from "../types";

export abstract class Tracker {
  abstract track(tasting: BadgeTasting): TrackedObject[];

  getEntityList(tasting: BadgeTasting): BadgeIdentityEntity[] {
    const { brand, bottler, distillers } = tasting.identity;
    const resultIds = new Set([brand.id]);
    const results = [brand];
    if (bottler && !resultIds.has(bottler.id)) {
      results.push(bottler);
      resultIds.add(bottler.id);
    }

    for (const distiller of distillers) {
      if (!resultIds.has(distiller.id)) {
        results.push(distiller);
        resultIds.add(distiller.id);
      }
    }

    return results;
  }
}
