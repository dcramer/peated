import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { countries, type Entity, type User } from "../db/schema";
import { notEmpty } from "../lib/filter";
import { type EntitySchema } from "../schemas";
import { CountrySerializer } from "./country";

export const EntitySerializer = serializer({
  attrs: async (itemList: Entity[], currentUser?: User) => {
    const countryIds = itemList.map((i) => i.countryId).filter(notEmpty);
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
    item: Entity,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof EntitySchema> => {
    return {
      id: item.id,
      name: item.name,
      shortName: item.shortName,
      type: item.type,
      description: item.description,
      yearEstablished: item.yearEstablished,
      website: item.website,
      country: attrs.country,
      region: item.region,
      address: item.address,
      location: item.location,
      createdAt: item.createdAt.toISOString(),

      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
    };
  },
});
