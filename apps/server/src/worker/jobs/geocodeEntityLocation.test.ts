import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { changes, entities } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test } from "vitest";
import geocodeEntityLocation from "./geocodeEntityLocation";

const originalGoogleMapsApiKey = config.GOOGLE_MAPS_API_KEY;

beforeEach(() => {
  config.GOOGLE_MAPS_API_KEY = "test-api-key";
});

afterEach(() => {
  config.GOOGLE_MAPS_API_KEY = originalGoogleMapsApiKey;
});

test("saves the geocoded address and location, and records the change", async ({
  fixtures,
  axiosMock,
}) => {
  const country = await fixtures.Country({ name: "Scotland" });
  const entity = await fixtures.Entity({
    name: "Springbank",
    countryId: country.id,
    address: "85 Longrow, Campbeltown",
  });
  axiosMock
    .onGet("https://maps.googleapis.com/maps/api/geocode/json", {
      params: {
        key: "test-api-key",
        address: "85 Longrow, Campbeltown,  Scotland",
      },
    })
    .reply(200, {
      status: "OK",
      results: [
        {
          formatted_address: "85 Longrow, Campbeltown PA28 6EX, UK",
          geometry: { location: { lat: 55.4268, lng: -5.6083 } },
        },
      ],
    });

  await geocodeEntityLocation({ entityId: entity.id });

  const [updated] = await db
    .select({ address: entities.address, location: entities.location })
    .from(entities)
    .where(eq(entities.id, entity.id));
  expect(updated).toEqual({
    address: "85 Longrow, Campbeltown PA28 6EX, UK",
    location: [-5.6083, 55.4268],
  });
  const recorded = await db
    .select({ data: changes.data })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.objectId, entity.id),
        eq(changes.type, "update"),
      ),
    );
  expect(recorded).toEqual([
    {
      data: {
        address: "85 Longrow, Campbeltown PA28 6EX, UK",
        location: [-5.6083, 55.4268],
      },
    },
  ]);
});

test("fails when Google finds no match", async ({ fixtures, axiosMock }) => {
  const entity = await fixtures.Entity({ address: "Nowhere Road" });
  axiosMock
    .onGet("https://maps.googleapis.com/maps/api/geocode/json")
    .reply(200, { status: "ZERO_RESULTS", results: [] });

  await expect(geocodeEntityLocation({ entityId: entity.id })).rejects.toThrow(
    `Failed to geocode address of Entity: ${entity.id}`,
  );
});
