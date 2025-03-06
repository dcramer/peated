import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import {
  countries,
  entities,
  regions,
  type Entity,
  type User,
} from "../db/schema";
import { notEmpty } from "../lib/filter";
import { type EntitySchema } from "../schemas";
import { CountrySerializer } from "./country";
import { RegionSerializer } from "./region";

export const EntitySerializer = serializer({
  attrs: async (
    itemList: Entity[],
    currentUser?: User,
  ): Promise<
    Record<number, { country: any; region: any; parent: any | null }>
  > => {
    const countryIds = itemList.map((i) => i.countryId).filter(notEmpty);
    const countryList = countryIds.length
      ? await db
          .select()
          .from(countries)
          .where(inArray(countries.id, countryIds))
      : [];

    const countriesById = countryList.length
      ? Object.fromEntries(
          (await serialize(CountrySerializer, countryList, currentUser)).map(
            (data, index) => [countryList[index].id, data],
          ),
        )
      : {};

    const regionIds = itemList.map((i) => i.regionId).filter(notEmpty);
    const regionList = regionIds.length
      ? await db.select().from(regions).where(inArray(regions.id, regionIds))
      : [];

    const regionsById = regionList.length
      ? Object.fromEntries(
          (await serialize(RegionSerializer, regionList, currentUser)).map(
            (data, index) => [regionList[index].id, data],
          ),
        )
      : {};

    const parentIds = itemList.map((i) => i.parentId).filter(notEmpty);
    const parentList = parentIds.length
      ? await db.select().from(entities).where(inArray(entities.id, parentIds))
      : [];

    // Use a simplified approach to avoid circular reference
    const parentsById: Record<number, { id: number; name: string }> = {};

    for (const parent of parentList) {
      parentsById[parent.id] = {
        id: parent.id,
        name: parent.name,
      };
    }

    return Object.fromEntries(
      itemList.map(
        (item): [number, { country: any; region: any; parent: any | null }] => {
          return [
            item.id,
            {
              country: item.countryId ? countriesById[item.countryId] : null,
              region: item.regionId ? regionsById[item.regionId] : null,
              parent: item.parentId
                ? {
                    id: item.parentId,
                    name: parentsById[item.parentId]?.name || "",
                  }
                : null,
            },
          ];
        },
      ),
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
      region: attrs.region,
      parent: attrs.parent,
      address: item.address,
      location: item.location,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.createdAt.toISOString(),

      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
    };
  },
});
