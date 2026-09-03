import {
  countries,
  type Country,
  type Region,
  type User,
} from "@peated/server/db/schema";
import { type RegionSchema } from "@peated/server/schemas";
import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { CountrySerializer } from "./country";

interface RegionAttrs {
  country: z.infer<typeof RegionSchema>["country"];
}

type RegionSerializerContext = {
  countries: Country[];
};

export const RegionSerializer = serializer({
  name: "region",
  attrs: async (
    itemList: Region[],
    currentUser?: User,
    context?: RegionSerializerContext,
  ) => {
    // RegionSerializer reuses only the caller's rows; later requests still read fresh totals.
    const countryRowsById = new Map(
      context?.countries.map((country) => [country.id, country]),
    );
    const missingCountryIds = [
      ...new Set(itemList.map((i) => i.countryId)),
    ].filter((id) => !countryRowsById.has(id));
    const missingCountries = missingCountryIds.length
      ? await db
          .select()
          .from(countries)
          .where(inArray(countries.id, missingCountryIds))
      : [];
    for (const country of missingCountries)
      countryRowsById.set(country.id, country);
    const countryList = [...countryRowsById.values()];

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
  item: (item: Region, attrs: RegionAttrs): z.infer<typeof RegionSchema> => {
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
