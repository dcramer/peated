import { and, asc, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Flight, User } from "../db/schema";
import {
  bottles,
  collectionBottles,
  flightBottles,
  tastings,
} from "../db/schema";
import { getReservedCollection } from "../lib/db";
import { type FlightDetailsSchema, type FlightSchema } from "../schemas";
import { BottleSerializer } from "./bottle";

type FlightBottle = z.infer<typeof FlightDetailsSchema>["bottles"][number];

type FlightAttrs = { bottles: FlightBottle[] };

function flightProjection(item: Flight): z.infer<typeof FlightSchema> {
  return {
    id: item.publicId,
    name: item.name,
    description: item.description,
    public: item.public,
    createdAt: item.createdAt.toISOString(),
  };
}

export const FlightSerializer = serializer({
  name: "flight",
  item: (item: Flight): z.infer<typeof FlightSchema> => flightProjection(item),
});

export const FlightDetailsSerializer = serializer({
  name: "flightDetails",
  attrs: async (
    itemList: Flight[],
    currentUser?: User | null,
  ): Promise<Record<number, FlightAttrs>> => {
    const flightIds = itemList.map(({ id }) => id);
    const memberships = await db
      .select()
      .from(flightBottles)
      .where(inArray(flightBottles.flightId, flightIds))
      .orderBy(asc(flightBottles.flightId), asc(flightBottles.bottleId));
    const bottleIds = [...new Set(memberships.map(({ bottleId }) => bottleId))];
    const bottleRows = bottleIds.length
      ? await db.select().from(bottles).where(inArray(bottles.id, bottleIds))
      : [];
    const serializedBottles = await serialize(
      BottleSerializer,
      bottleRows,
      currentUser,
    );
    const bottleById = new Map(
      serializedBottles.map((bottle) => [bottle.id, bottle]),
    );

    const tastedRows =
      currentUser && bottleIds.length
        ? await db
            .selectDistinct({
              flightId: tastings.flightId,
              bottleId: tastings.bottleId,
            })
            .from(tastings)
            .where(
              and(
                inArray(tastings.flightId, flightIds),
                inArray(tastings.bottleId, bottleIds),
                eq(tastings.createdById, currentUser.id),
              ),
            )
        : [];
    const tastedKeys = new Set(
      tastedRows.flatMap(({ flightId, bottleId }) =>
        flightId === null ? [] : [`${flightId}:${bottleId}`],
      ),
    );

    const library = currentUser
      ? await getReservedCollection(db, currentUser.id, "library")
      : null;
    const libraryBottleIds = new Set(
      library && bottleIds.length
        ? (
            await db
              .selectDistinct({ bottleId: collectionBottles.bottleId })
              .from(collectionBottles)
              .where(
                and(
                  eq(collectionBottles.collectionId, library.id),
                  inArray(collectionBottles.bottleId, bottleIds),
                ),
              )
          ).map(({ bottleId }) => bottleId)
        : [],
    );

    const bottlesByFlightId = new Map<number, FlightBottle[]>();
    memberships.forEach((membership) => {
      const bottle = bottleById.get(membership.bottleId);
      if (!bottle) {
        throw new Error(
          `flight membership ${membership.flightId} references missing Bottle ${membership.bottleId}`,
        );
      }
      const flightBottles = bottlesByFlightId.get(membership.flightId) ?? [];
      flightBottles.push({
        bottle,
        hasTasted: tastedKeys.has(`${membership.flightId}:${bottle.id}`),
        isLibrary: libraryBottleIds.has(bottle.id),
      });
      bottlesByFlightId.set(membership.flightId, flightBottles);
    });

    return Object.fromEntries(
      itemList.map(({ id }) => [
        id,
        {
          bottles: (bottlesByFlightId.get(id) ?? []).sort(
            (left, right) =>
              left.bottle.fullName.localeCompare(right.bottle.fullName) ||
              left.bottle.id - right.bottle.id,
          ),
        },
      ]),
    );
  },
  item: (
    item: Flight,
    attrs: FlightAttrs,
  ): z.infer<typeof FlightDetailsSchema> => {
    return {
      ...flightProjection(item),
      bottles: attrs.bottles,
    };
  },
});
