import type { SQL } from "drizzle-orm";
import type { TastingWithRelations, TrackedObject } from "../types";

export type CheckConfigSchema = Record<string, any>;

export abstract class Check {
  schema: null | CheckConfigSchema = null;

  maxLevel = 25;

  abstract track(
    config: CheckConfigSchema,
    tasting: TastingWithRelations,
  ): TrackedObject[];

  abstract buildWhereClause(config: CheckConfigSchema): SQL[];

  abstract test(
    config: CheckConfigSchema,
    tasting: TastingWithRelations,
  ): boolean;

  async parseConfig(config: unknown) {
    return this.schema ? this.schema.parse(config) : {};
  }
}

export abstract class BaseBottleCheck extends Check {
  track(
    config: CheckConfigSchema,
    tasting: TastingWithRelations,
  ): TrackedObject[] {
    return [{ type: "bottle", id: tasting.bottle.id }];
  }
}
