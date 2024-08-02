import type {
  Bottle,
  BottlesToDistillers,
  Entity,
  Tasting,
} from "@peated/server/db/schema";

export type TastingWithRelations = Tasting & {
  bottle: Bottle & {
    brand: Entity;
    bottler: Entity | null;
    bottlesToDistillers: (BottlesToDistillers & {
      distiller: Entity;
    })[];
  };
};

export type TrackedObject = { type: "bottle" | "entity"; id: number };
