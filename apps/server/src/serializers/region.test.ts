import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { serialize } from ".";
import { EntitySerializer } from "./entity";
import { RegionSerializer } from "./region";

test("reuses supplied country rows and loads missing region countries", async ({
  fixtures,
}) => {
  const firstCountry = await fixtures.Country({ totalBottles: 12 });
  const secondCountry = await fixtures.Country({ totalBottles: 34 });
  const firstRegion = await fixtures.Region({ countryId: firstCountry.id });
  const secondRegion = await fixtures.Region({ countryId: secondCountry.id });

  await db
    .update(countries)
    .set({ totalBottles: 56 })
    .where(eq(countries.id, firstCountry.id));

  const results = await serialize(
    RegionSerializer,
    [firstRegion, secondRegion],
    undefined,
    [],
    {
      countries: [firstCountry],
    },
  );
  expect(results.map((region) => region.country?.totalBottles)).toEqual([
    12, 34,
  ]);
  const fresh = await serialize(RegionSerializer, firstRegion);
  expect(fresh.country?.totalBottles).toBe(56);
});

test("keeps entity and nested region countries complete and fresh", async ({
  fixtures,
}) => {
  const country = await fixtures.Country({ totalBottles: 12 });
  const region = await fixtures.Region({ countryId: country.id });
  const entity = await fixtures.Entity({
    countryId: country.id,
    regionId: region.id,
  });

  const first = await serialize(EntitySerializer, entity);
  expect(first.country).toEqual(first.region?.country);
  expect(first.country?.totalBottles).toBe(12);

  await db
    .update(countries)
    .set({ totalBottles: 34 })
    .where(eq(countries.id, country.id));
  const second = await serialize(EntitySerializer, entity);
  expect(second.country).toEqual(second.region?.country);
  expect(second.country?.totalBottles).toBe(34);
});
