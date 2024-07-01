import { type CountrySchema } from "@peated/server/schemas";
import { type z } from "zod";
import { serializer } from ".";
import {
  type SerializedPoint,
  type UnserializedPoint,
} from "../db/columns/geography";
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
      location: item.location
        ? ((JSON.parse(item.location) as UnserializedPoint).coordinates as [
            number,
            number,
          ])
        : null,
    };
  },
});
