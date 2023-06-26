import type {
  Bottle,
  BottlesToDistillers,
  Entity,
  Tasting,
} from "../../db/schema";

export type BadgeConfig = Record<string, any>;

export type TastingWithRelations = Tasting & {
  bottle: Bottle & {
    brand: Entity;
    bottler: Entity | null;
    bottlesToDistillers: (BottlesToDistillers & {
      distiller: Entity;
    })[];
  };
};

export interface IBadge<T extends BadgeConfig> {
  test: (config: T, tasting: TastingWithRelations) => boolean;

  checkConfig: (config: unknown) => Promise<T>;
}
