import type { SQL } from "drizzle-orm";
import type {
  Bottle,
  BottlesToDistillers,
  Entity,
  Tasting,
} from "../../db/schema";

export type CheckConfigSchema = Record<string, any>;

export type TastingWithRelations = Tasting & {
  bottle: Bottle & {
    brand: Entity;
    bottler: Entity | null;
    bottlesToDistillers: (BottlesToDistillers & {
      distiller: Entity;
    })[];
  };
};

export type TrackedEntity = { type: "entity"; id: number };
export type TrackedBottle = { type: "bottle"; id: number };
export type TrackedObject = TrackedEntity | TrackedBottle;

export abstract class Check {
  schema: null | CheckConfigSchema = null;

  maxLevel = 25;

  track(
    config: CheckConfigSchema,
    tasting: TastingWithRelations,
  ): TrackedObject[] {
    return [{ type: "bottle", id: tasting.bottle.id }];
  }

  abstract buildWhereClause(config: CheckConfigSchema): SQL[];

  abstract test(
    config: CheckConfigSchema,
    tasting: TastingWithRelations,
  ): boolean;

  async parseConfig(config: unknown) {
    return this.schema ? this.schema.parse(config) : {};
  }
}

// TODO: use math here so perf is better
export function defaultCalculateLevel(
  totalXp: number,
  maxLevel: number,
): number | null {
  const a = 0.02;
  const b = 0.5;
  const c = 4;

  let level = 0;
  let requiredXp = 0;
  while (requiredXp <= totalXp && level < maxLevel + 1) {
    level++;
    requiredXp += a * Math.pow(level, 2) + b * level + c;
  }

  return level - 1;
}
