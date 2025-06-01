import type { CountrySchema } from "@peated/server/schemas";
import type { z } from "zod";
import { serializer } from ".";
import type { Country, User } from "../db/schema";

export const CountrySerializer = serializer({
  name: "country",
  item: (
    item: Country,
    attrs: Record<string, any>,
    currentUser?: User
  ): z.infer<typeof CountrySchema> => {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      summary: item.summary,
      location: item.location,
      totalBottles: item.totalBottles,
      totalDistillers: item.totalDistillers,
    };
  },
});
