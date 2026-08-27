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
import { formatPeatedId } from "../lib/peatedId";
import { type EntitySchema } from "../schemas";
import { CountrySerializer } from "./country";
import { RegionSerializer } from "./region";

interface EntityAttrs {
  country: z.infer<typeof EntitySchema>["country"];
  owner: z.infer<typeof EntitySchema>["owner"];
  region: z.infer<typeof EntitySchema>["region"];
}

export const EntitySerializer = serializer({
  name: "entity",
  attrs: async (itemList: Entity[], currentUser?: User) => {
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

    const ownerIds = itemList.map((item) => item.ownerId).filter(notEmpty);
    const ownerList = ownerIds.length
      ? await db
          .select({ id: entities.id, name: entities.name })
          .from(entities)
          .where(inArray(entities.id, ownerIds))
      : [];
    const ownersById = Object.fromEntries(
      ownerList.map((owner) => [
        owner.id,
        {
          id: owner.id,
          peatedId: formatPeatedId("entity", owner.id),
          name: owner.name,
        },
      ]),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            country: item.countryId ? countriesById[item.countryId] : null,
            owner: item.ownerId ? ownersById[item.ownerId] : null,
            region: item.regionId ? regionsById[item.regionId] : null,
          },
        ];
      }),
    );
  },
  item: (item: Entity, attrs: EntityAttrs): z.infer<typeof EntitySchema> => {
    if (!item.kind) {
      throw new Error(`Entity ${item.id} has no kind.`);
    }

    return {
      id: item.id,
      peatedId: formatPeatedId("entity", item.id),
      name: item.name,
      shortName: item.shortName,
      kind: item.kind,
      ownerId: item.ownerId,
      owner: attrs.owner,
      description: item.description,
      yearEstablished: item.yearEstablished,
      website: item.website,
      country: attrs.country,
      region: attrs.region,
      address: item.address,
      location: item.location,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),

      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
    };
  },
});
