import { type z } from "zod";
import { serializer } from ".";
import config from "../config";
import type { Badge, User } from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import type { BadgeSchema } from "../schemas";

export const BadgeSerializer = serializer({
  name: "badge",
  item: (
    item: Badge,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof BadgeSchema> => {
    return {
      id: item.id,
      name: item.name,
      maxLevel: item.maxLevel,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      ...(currentUser?.admin
        ? { checks: item.checks, tracker: item.tracker, formula: item.formula }
        : {}),
    };
  },
});
