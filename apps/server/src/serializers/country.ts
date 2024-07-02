import { type CountrySchema } from "@peated/server/schemas";
import { type z } from "zod";
import { serializer } from ".";
import { type Country, type User } from "../db/schema";

export const CountrySerializer = serializer({
  item: (
    item: Country,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof CountrySchema> => {
    return {
      name: item.name,
      slug: item.slug,
      description: item.description,
      location: item.location,
      totalBottles: item.totalBottles,
      totalDistillers: item.totalDistillers,
    };
  },
});
