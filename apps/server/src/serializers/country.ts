import { type CountrySchema } from "@peated/server/schemas";
import { type z } from "zod";
import { serializer } from ".";
import { type SerializedPoint } from "../db/columns";
import { type Country, type User } from "../db/schema";

export const CountrySerializer = serializer({
  item: (
    item: Country & {
      location: SerializedPoint;
    },
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof CountrySchema> => {
    return {
      name: item.name,
      slug: item.slug,
      location: item.location,
    };
  },
});
