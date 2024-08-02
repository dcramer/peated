import type { z } from "zod";
import { Region } from "../test/fixtures";
import waitError from "../test/waitError";
import { RegionCheck } from "./regionCheck";
import { createTastingForBadge } from "./testHelpers";

describe("parseConfig", () => {
  test("valid params", async () => {
    const badgeImpl = new RegionCheck();
    const config = {
      country: 1,
      region: 1,
    };
    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(`
      {
        "country": 1,
        "region": 1,
      }
    `);
  });

  test("no country", async () => {
    const badgeImpl = new RegionCheck();
    const config = {
      region: 1,
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "code": "invalid_type",
          "expected": "number",
          "received": "undefined",
          "path": [
            "country"
          ],
          "message": "Required"
        }
      ]]
    `);
  });

  test("no region", async () => {
    const badgeImpl = new RegionCheck();
    const config = {
      country: 1,
    };
    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(`
      {
        "country": 1,
        "region": null,
      }
    `);
  });
});

describe("track", () => {
  test("tracks bottle", async ({ fixtures }) => {
    const region = await fixtures.Region();
    const brand = await fixtures.Entity({
      name: "Brand",
      countryId: region.countryId,
      regionId: region.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      brand,
    });

    const badgeImpl = new RegionCheck();
    const config = {
      country: region.countryId,
      region: region.id,
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
    expect(badgeImpl.track(config, tasting)).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "type": "bottle",
        },
      ]
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
