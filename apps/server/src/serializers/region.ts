import { countries, type Region, type User } from "@peated/server/db/schema";
import { type RegionSchema } from "@peated/server/schemas";
import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { CountrySerializer } from "./country";

export const RegionSerializer = serializer({
  name: "region",
  attrs: async (itemList: Region[], currentUser?: User) => {
    const countryIds = itemList.map((i) => i.countryId);
    const countryList = countryIds.length
      ? await db
          .select()
          .from(countries)
          .where(inArray(countries.id, countryIds))
      : [];

    const countriesById = Object.fromEntries(
      (await serialize(CountrySerializer, countryList, currentUser)).map(
        (data, index) => [countryList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            country: item.countryId ? countriesById[item.countryId] : null,
          },
        ];
      }),
    );
  },
  item: (
    item: Region,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof RegionSchema> => {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      country: attrs.country,
      description: item.description,
      location: item.location,
      totalBottles: item.totalBottles,
      totalDistillers: item.totalDistillers,
    };
  },
});
