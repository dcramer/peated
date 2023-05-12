import { Bottle, Entity, User } from "../../db/schema";

export const serializeBottle = (
  bottle: Bottle & {
    brand: Entity;
    distillers?: Entity[];
  },
  currentUser?: User
) => {
  return {
    id: bottle.id,
    name: bottle.name,
    statedAge: bottle.statedAge,
    category: bottle.category,
    brand: bottle.brand,
    distillers: bottle.distillers || [],
  };
};
