import type { z } from "zod";
import { Region } from "../../test/fixtures";
import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { RegionCheck, RegionCheckConfigSchema } from "./regionCheck";

describe("config schema", () => {
  test("valid params", async () => {
    const config = {
      country: 1,
      region: 1,
    };
    expect(await RegionCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "country": 1,
        "region": 1,
      }
    `);
  });

  test("no country", async () => {
    const config = {
      region: 1,
    };
    const err = await waitError(RegionCheckConfigSchema.parseAsync(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "expected": "number",
          "code": "invalid_type",
          "path": [
            "country"
          ],
          "message": "Invalid input: expected number, received undefined"
        }
      ]]
    `);
  });

  test("no region", async () => {
    const config = {
      country: 1,
    };
    expect(await RegionCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "country": 1,
        "region": null,
      }
    `);
  });
});

describe("test", () => {
  test("matches bottle with regionId on brand", async ({ fixtures }) => {
    const region = await fixtures.Region();
    const brand = await fixtures.Entity({
      name: "Brand",
      countryId: region.countryId,
      regionId: region.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [],
      brand,
    });

    const badgeImpl = new RegionCheck();
    const config = {
      country: region.countryId,
      region: region.id,
    } satisfies z.infer<typeof RegionCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("matches bottle with only countryId on brand", async ({ fixtures }) => {
    const region = await fixtures.Region();
    const brand = await fixtures.Entity({
      name: "Brand",
      countryId: region.countryId,
      regionId: region.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [],
      brand,
    });

    const badgeImpl = new RegionCheck();
    const config = {
      country: region.countryId,
      region: null,
    } satisfies z.infer<typeof RegionCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("treats a zero region as country-only for a brand", async ({
    fixtures,
  }) => {
    const region = await fixtures.Region();
    const brand = await fixtures.Entity({
      countryId: region.countryId,
      regionId: region.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [],
      brand,
    });

    expect(
      new RegionCheck().test({ country: region.countryId, region: 0 }, tasting),
    ).toBe(true);
  });

  test("treats a zero region as country-only for a distiller", async ({
    fixtures,
  }) => {
    const brandRegion = await fixtures.Region();
    const distillerRegion = await fixtures.Region();
    const brand = await fixtures.Entity({
      countryId: brandRegion.countryId,
      regionId: brandRegion.id,
    });
    const distiller = await fixtures.Entity({
      countryId: distillerRegion.countryId,
      regionId: distillerRegion.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      brand,
      distillers: [distiller],
    });

    expect(
      new RegionCheck().test(
        { country: distillerRegion.countryId, region: 0 },
        tasting,
      ),
    ).toBe(true);
  });

  test("doesnt match bottle", async ({ fixtures }) => {
    const region = await fixtures.Region({ name: "Nebraska" });
    const brand = await fixtures.Entity({
      name: "Brand",
      countryId: region.countryId,
      regionId: region.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [],
      brand,
    });

    const region2 = await fixtures.Region({
      name: "California",
      countryId: region.countryId,
    });

    const badgeImpl = new RegionCheck();
    const config = {
      country: region2.countryId,
      region: region2.id,
    } satisfies z.infer<typeof RegionCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });

  test("matches distillers but does not treat the bottler as origin", async ({
    fixtures,
  }) => {
    const brandRegion = await fixtures.Region();
    const distillerRegion = await fixtures.Region();
    const bottlerRegion = await fixtures.Region();
    const brand = await fixtures.Entity({
      countryId: brandRegion.countryId,
      regionId: brandRegion.id,
    });
    const distiller = await fixtures.Entity({
      countryId: distillerRegion.countryId,
      regionId: distillerRegion.id,
    });
    const bottler = await fixtures.Entity({
      countryId: bottlerRegion.countryId,
      regionId: bottlerRegion.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      brand,
      bottler,
      distillers: [distiller],
    });
    const badgeImpl = new RegionCheck();

    expect(
      badgeImpl.test(
        { country: distillerRegion.countryId, region: distillerRegion.id },
        tasting,
      ),
    ).toBe(true);
    expect(
      badgeImpl.test(
        { country: bottlerRegion.countryId, region: bottlerRegion.id },
        tasting,
      ),
    ).toBe(false);
  });
});
