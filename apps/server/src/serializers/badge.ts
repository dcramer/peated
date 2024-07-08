import { type z } from "zod";
import { serializer } from ".";
import type { Badge, User } from "../db/schema";
import { type BadgeSchema } from "../schemas";

export const BadgeSerializer = serializer({
  item: (
    item: Badge,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof BadgeSchema> => {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      config: item.config,
    };
  },
});
