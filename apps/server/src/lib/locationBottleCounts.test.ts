import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottlesToDistillers,
  countries,
  regions,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import {
  checkLocationBottleCounts,
  getBottleProductionLocations,
  repairLocationBottleCount,
  updateLocationBottleCounts,
} from "./locationBottleCounts";

describe("location Bottle counts", () => {
  test("counts one Bottle once when Distilleries share a location", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({ totalBottles: 0 });
    const region = await fixtures.Region({
      countryId: country.id,
      totalBottles: 0,
    });
    const firstDistillery = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });
    const secondDistillery = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });
    const bottle = await fixtures.Bottle({
      distillerIds: [firstDistillery.id, secondDistillery.id],
    });
    await db.update(countries).set({ totalBottles: 0 });
    await db.update(regions).set({ totalBottles: 0 });

    await db.transaction(async (tx) => {
      const after = await getBottleProductionLocations(tx, [bottle.id]);
      await updateLocationBottleCounts(tx, [], after);
    });

    await expect(
      db.query.countries.findFirst({ where: eq(countries.id, country.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(
      db.query.regions.findFirst({ where: eq(regions.id, region.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
  });

  test("moves a Bottle between production locations", async ({ fixtures }) => {
    const oldCountry = await fixtures.Country({ totalBottles: 0 });
    const oldRegion = await fixtures.Region({
      countryId: oldCountry.id,
      totalBottles: 0,
    });
    const newCountry = await fixtures.Country({ totalBottles: 0 });
    const newRegion = await fixtures.Region({
      countryId: newCountry.id,
      totalBottles: 0,
    });
    const oldDistillery = await fixtures.Entity({
      countryId: oldCountry.id,
      regionId: oldRegion.id,
    });
    const newDistillery = await fixtures.Entity({
      countryId: newCountry.id,
      regionId: newRegion.id,
    });
    const bottle = await fixtures.Bottle({
      distillerIds: [oldDistillery.id],
    });

    await db.transaction(async (tx) => {
      const before = await getBottleProductionLocations(tx, [bottle.id]);
      await tx
        .delete(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, bottle.id));
      await tx.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId: newDistillery.id,
      });
      const after = await getBottleProductionLocations(tx, [bottle.id]);
      await updateLocationBottleCounts(tx, before, after);
    });

    await expect(
      db.query.countries.findFirst({ where: eq(countries.id, oldCountry.id) }),
    ).resolves.toMatchObject({ totalBottles: 0 });
    await expect(
      db.query.regions.findFirst({ where: eq(regions.id, oldRegion.id) }),
    ).resolves.toMatchObject({ totalBottles: 0 });
    await expect(
      db.query.countries.findFirst({ where: eq(countries.id, newCountry.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(
      db.query.regions.findFirst({ where: eq(regions.id, newRegion.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
  });

  test("repairs an old undercount when removing a Bottle", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({ totalBottles: 0 });
    const region = await fixtures.Region({
      countryId: country.id,
      totalBottles: 0,
    });
    const distillery = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });
    const removedBottle = await fixtures.Bottle({
      distillerIds: [distillery.id],
    });
    await fixtures.Bottle({ distillerIds: [distillery.id] });
    await db
      .update(countries)
      .set({ totalBottles: 0 })
      .where(eq(countries.id, country.id));
    await db
      .update(regions)
      .set({ totalBottles: 0 })
      .where(eq(regions.id, region.id));

    await db.transaction(async (tx) => {
      const before = await getBottleProductionLocations(tx, [removedBottle.id]);
      await tx.insert(bottleTombstones).values({
        bottleId: removedBottle.id,
      });
      const after = await getBottleProductionLocations(tx, [removedBottle.id]);
      await updateLocationBottleCounts(tx, before, after);
    });

    await expect(
      db.query.countries.findFirst({ where: eq(countries.id, country.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(
      db.query.regions.findFirst({ where: eq(regions.id, region.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
  });

  test("counts concurrent Bottles without losing an update", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({ totalBottles: 0 });
    const region = await fixtures.Region({
      countryId: country.id,
      totalBottles: 0,
    });
    const distillery = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });
    const first = await fixtures.Bottle({ distillerIds: [distillery.id] });
    const second = await fixtures.Bottle({ distillerIds: [distillery.id] });
    await db
      .update(countries)
      .set({ totalBottles: 0 })
      .where(eq(countries.id, country.id));
    await db
      .update(regions)
      .set({ totalBottles: 0 })
      .where(eq(regions.id, region.id));

    await Promise.all(
      [first.id, second.id].map((bottleId) =>
        db.transaction(async (tx) => {
          const after = await getBottleProductionLocations(tx, [bottleId]);
          await updateLocationBottleCounts(tx, [], after);
        }),
      ),
    );

    await expect(
      db.query.countries.findFirst({ where: eq(countries.id, country.id) }),
    ).resolves.toMatchObject({ totalBottles: 2 });
    await expect(
      db.query.regions.findFirst({ where: eq(regions.id, region.id) }),
    ).resolves.toMatchObject({ totalBottles: 2 });
  });

  test("finds and repairs wrong saved counts", async ({ fixtures }) => {
    const country = await fixtures.Country({ totalBottles: 0 });
    const region = await fixtures.Region({
      countryId: country.id,
      totalBottles: 0,
    });
    const correctEmptyCountry = await fixtures.Country({ totalBottles: 0 });
    const distillery = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });
    await fixtures.Bottle({ distillerIds: [distillery.id] });
    await db
      .update(countries)
      .set({ totalBottles: 9 })
      .where(eq(countries.id, country.id));
    await db
      .update(regions)
      .set({ totalBottles: 8 })
      .where(eq(regions.id, region.id));

    const locations = [
      { kind: "country" as const, locationId: country.id },
      { kind: "country" as const, locationId: correctEmptyCountry.id },
      { kind: "region" as const, locationId: region.id },
    ];
    await expect(checkLocationBottleCounts(locations)).resolves.toEqual([
      {
        kind: "country",
        locationId: country.id,
        savedCount: 9,
        actualCount: 1,
      },
      {
        kind: "region",
        locationId: region.id,
        savedCount: 8,
        actualCount: 1,
      },
    ]);
    await expect(checkLocationBottleCounts([])).resolves.toEqual([]);

    await expect(repairLocationBottleCount(locations[0]!)).resolves.toEqual({
      kind: "country",
      locationId: country.id,
      savedCount: 9,
      actualCount: 1,
    });
    await expect(repairLocationBottleCount(locations[2]!)).resolves.toEqual({
      kind: "region",
      locationId: region.id,
      savedCount: 8,
      actualCount: 1,
    });
    await expect(checkLocationBottleCounts(locations)).resolves.toEqual([]);
  });
});
