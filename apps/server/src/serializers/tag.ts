import { type TagSchema } from "@peated/server/schemas";
import { type z } from "zod";
import { serializer } from ".";
import { type Tag, type User } from "../db/schema";

export const TagSerializer = serializer({
  name: "tag",
  item: (
    item: Tag,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof TagSchema> => {
    return {
      name: item.name,
      synonyms: item.synonyms,
      tagCategory: item.tagCategory,
      flavorProfiles: item.flavorProfiles,
    };
  },
});
