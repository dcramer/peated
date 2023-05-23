import { Bottle, Entity, Tasting } from "../../db/schema";

export type BadgeConfig = Record<string, any>;

export type TastingWithRelations = Tasting & {
  bottle: Bottle & {
    brand: Entity;
    distillers: Entity[];
  };
};

export interface IBadge<T extends BadgeConfig> {
  test: (config: T, tasting: TastingWithRelations) => boolean;
}
