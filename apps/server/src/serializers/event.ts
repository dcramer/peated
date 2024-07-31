import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { countries, type Event, type User } from "../db/schema";
import { notEmpty } from "../lib/filter";
import { type EventSchema } from "../schemas";
import { CountrySerializer } from "./country";

export const EventSerializer = serializer({
  attrs: async (itemList: Event[], currentUser?: User) => {
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
    item: Event,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof EventSchema> => {
    return {
      id: item.id,
      name: item.name,
      dateStart: item.dateStart,
      dateEnd: item.dateEnd,
      repeats: item.repeats,
      description: item.description,
      website: item.website,
      country: attrs.country,
      location: item.location,
    };
  },
});
