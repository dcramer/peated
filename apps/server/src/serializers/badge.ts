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
    _attrs: Record<never, never>,
    currentUser?: User,
  ): z.infer<typeof BadgeSchema> => {
    const badge: z.infer<typeof BadgeSchema> = {
      id: item.id,
      name: item.name,
      maxLevel: item.maxLevel,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
    };
    if (currentUser?.admin) {
      badge.checks = item.checks;
      badge.tracker = item.tracker;
      badge.formula = item.formula;
    }
    return badge;
  },
});
