import config from "@peated/server/config";
import { routerClient } from "@peated/server/orpc/router";

describe.each([false, true])(
  "GET /bottles/create-candidates (TIN=%s)",
  (tin) => {
    const original = config.BOTTLE_SEARCH_TIN;
    beforeEach(() => {
      config.BOTTLE_SEARCH_TIN = tin;
    });
    afterEach(() => {
      config.BOTTLE_SEARCH_TIN = original;
    });
    test("finds a rare release when popular unrelated Bottles fill the text window", async ({
      fixtures,
    }) => {
      const brand = await fixtures.Entity({ name: "SPEY" });
      const otherBrand = await fixtures.Entity({ name: "Other producer" });
      const expected = await fixtures.Bottle({
        name: "30-year-old",
        brandId: brand.id,
        statedAge: 30,
        abv: 46,
      });
      for (let index = 0; index < 101; index++) {
        await fixtures.Bottle({
          name: `30-year-old Edition ${index}`,
          brandId: otherBrand.id,
          statedAge: 30,
          totalTastings: 100,
        });
      }
      const { results } = await routerClient.bottles.createCandidates({
        name: "30-year-old",
        brand: { id: brand.id, name: brand.name },
        statedAge: 30,
        abv: 46,
      });
      expect(results.map((b) => b.id)).toEqual([expected.id]);
      expect(results[0].brand.id).toBe(brand.id);
      expect(results[0].abv).toBe(46);
    });

    test("uses physical distillery candidates even when the supplied Brand is wrong", async ({
      fixtures,
    }) => {
      const wrongBrand = await fixtures.Entity({ name: "Wrong owner" });
      const brand = await fixtures.Entity({ name: "Independent bottler" });
      const distiller = await fixtures.Entity({
        name: "Benrinnes",
        kind: "distillery",
      });
      const expected = await fixtures.Bottle({
        name: "1979",
        brandId: brand.id,
        distillerIds: [distiller.id],
        vintageYear: 1979,
        caskNumber: "62",
        abv: 42.1,
      });
      const { results } = await routerClient.bottles.createCandidates({
        name: "Benrinnes 1979",
        brand: { id: wrongBrand.id, name: wrongBrand.name },
        distillers: [{ id: distiller.id, name: distiller.name }],
        vintageYear: 1979,
        caskNumber: "62",
        abv: 42.1,
      });
      expect(results[0]?.id).toBe(expected.id);
      expect(results[0]?.distillers.map((d) => d.id)).toEqual([distiller.id]);
    });

    test("finds the Yamazaki regression despite the wrong Brand and collection suffix", async ({
      fixtures,
    }) => {
      const suntory = await fixtures.Entity({ name: "Suntory" });
      const yamazaki = await fixtures.Entity({
        name: "Yamazaki",
        kind: "distillery",
      });
      const existing = await fixtures.Bottle({
        name: "Peated Malt Spanish Oak",
        brandId: yamazaki.id,
        distillerIds: [yamazaki.id],
      });
      await fixtures.Bottle({
        name: "Peated Malt",
        brandId: yamazaki.id,
        distillerIds: [yamazaki.id],
      });

      const { results } = await routerClient.bottles.createCandidates({
        name: "The Yamazaki Peated Malt Spanish Oak - Kogei Collection",
        brand: { id: suntory.id, name: suntory.name },
        distillers: [{ id: yamazaki.id, name: yamazaki.name }],
      });

      expect(results[0]?.id).toBe(existing.id);
    });

    test("does not search a generic name without supporting identity facts", async ({
      fixtures,
    }) => {
      await fixtures.Bottle({ name: "12-year-old", statedAge: 12 });

      const { results } = await routerClient.bottles.createCandidates({
        name: "12-year-old",
      });

      expect(results).toEqual([]);
    });

    test("returns only active Bottles", async ({ fixtures }) => {
      const brand = await fixtures.Entity({ name: "Candidate Brand" });
      const active = await fixtures.Bottle({
        name: "Distinctive Orchard Reserve",
        brandId: brand.id,
      });
      await fixtures.LegacyBottle({
        name: "Distinctive Orchard Reserve",
        brandId: brand.id,
      });

      const { results } = await routerClient.bottles.createCandidates({
        name: "Distinctive Orchard Reserve",
        brand: { id: brand.id, name: brand.name },
      });

      expect(results.map(({ id }) => id)).toEqual([active.id]);
    });

    test("ranks exact release facts ahead of unknown and neighboring values", async ({
      fixtures,
    }) => {
      const brand = await fixtures.Entity({ name: "Independent Bottler" });
      const neighboring = await fixtures.Bottle({
        name: "Highland Release",
        brandId: brand.id,
        abv: 49.65,
        caskNumber: "53-322",
      });
      const unknown = await fixtures.Bottle({
        name: "Highland Release",
        brandId: brand.id,
      });
      const exact = await fixtures.Bottle({
        name: "Highland Release",
        brandId: brand.id,
        abv: 49.6,
        caskNumber: "53.322",
      });

      const { results } = await routerClient.bottles.createCandidates({
        name: "Highland Release",
        brand: { id: brand.id, name: brand.name },
        abv: 49.6,
        caskNumber: "53.322",
        limit: 3,
      });

      expect(results.map((b) => b.id)).toEqual([
        exact.id,
        unknown.id,
        neighboring.id,
      ]);
    });

    test("accepts the normalized Bottle draft and ranks distinguishing facts", async ({
      fixtures,
    }) => {
      const brand = await fixtures.Entity({ name: "Draft Match Brand" });
      await fixtures.Bottle({
        name: "Distinctive Harbor Ember",
        brandId: brand.id,
        noAgeStatement: false,
        singleCask: false,
        caskStrength: false,
        maturation: "Ex-bourbon barrels",
        caskNumber: "18",
        outturn: 480,
      });
      const matching = await fixtures.Bottle({
        name: "Distinctive Harbor Ember",
        brandId: brand.id,
        noAgeStatement: true,
        singleCask: true,
        caskStrength: true,
        maturation: "Mizunara oak",
        caskNumber: "35.401",
        outturn: 240,
      });

      const { results } = await routerClient.bottles.createCandidates({
        name: "Distinctive Harbor Ember",
        brand: { id: brand.id, name: brand.name },
        distillers: [],
        bottler: null,
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: null,
        noAgeStatement: true,
        caskStrength: true,
        singleCask: true,
        naturalColor: null,
        nonChillFiltered: null,
        maltPhenolPpm: null,
        abv: null,
        vintageYear: null,
        bottlingYear: null,
        releaseYear: null,
        releaseMonth: null,
        releaseDay: null,
        maturation: "Mizunara oak",
        caskNumber: "35.401",
        outturn: 240,
        description: null,
        descriptionSrc: null,
        flavorProfile: null,
        tastingNotes: null,
      });

      expect(results[0]?.id).toBe(matching.id);
    });
  },
);

test("finds an accepted exact reference before its search document refreshes", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle({ name: "Established Release" });
  await fixtures.BottleReference({
    name: "Retailer Exclusive Alias",
    bottleId: bottle.id,
    ignored: false,
  });
  const result = await routerClient.bottles.createCandidates({
    name: "Retailer Exclusive Alias",
  });
  expect(result.results.map((b) => b.id)).toContain(bottle.id);
});

test("TIN can retrieve misspellings without requiring a producer ID", async ({
  fixtures,
}) => {
  const original = config.BOTTLE_SEARCH_TIN;
  config.BOTTLE_SEARCH_TIN = true;
  try {
    const bottle = await fixtures.Bottle({ name: "Glentauchers Reserve" });
    const result = await routerClient.bottles.createCandidates({
      name: "Glentaucher Reservr",
    });
    expect(result.results.map((b) => b.id)).toContain(bottle.id);
  } finally {
    config.BOTTLE_SEARCH_TIN = original;
  }
});
