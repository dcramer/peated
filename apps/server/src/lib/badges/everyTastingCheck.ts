import type { TastingWithRelations, TrackedObject } from "./base";
import { Check } from "./base";

export class EveryTastingCheck extends Check {
  buildWhereClause(config: unknown) {
    return [];
  }

  test(config: unknown, tasting: TastingWithRelations) {
    return true;
  }

  track(config: unknown, tasting: TastingWithRelations): TrackedObject[] {
    return [];
  }
}
