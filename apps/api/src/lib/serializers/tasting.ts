import config from "../../config";
import { Bottle, Edition, Entity, Tasting, User } from "../../db/schema";
import { serializeBottle } from "./bottle";
import { serializeUser } from "./user";

export const serializeTasting = (
  tasting: Tasting & {
    createdBy: User;
    edition?: Edition | null;
    bottle: Bottle & {
      brand: Entity;
      distillers?: Entity[];
    };
    hasToasted?: boolean;
  },
  currentUser?: User,
) => {
  const data: { [key: string]: any } = {
    id: tasting.id,
    imageUrl: tasting.imageUrl
      ? `${config.URL_PREFIX}${tasting.imageUrl}`
      : null,
    bottle: serializeBottle(tasting.bottle, currentUser),
    createdBy: serializeUser(tasting.createdBy, currentUser),
    comments: tasting.comments,
    tags: tasting.tags,
    rating: tasting.rating,
    edition: tasting.edition,
    createdAt: tasting.createdAt,
    hasToasted: tasting.hasToasted,
  };
  return data;
};

export const serializeTastingRef = (
  tasting: {
    id: number;
    bottle: {
      id: number;
      name: string;
      brand: {
        id: number;
        name: string;
      };
    };
  },
  currentUser?: User,
) => {
  return {
    id: tasting.id,
    bottle: {
      name: tasting.bottle.name,
      brand: {
        id: tasting.bottle.brand.id,
        name: tasting.bottle.brand.name,
      },
    },
  };
};
