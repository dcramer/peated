import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottles/create-candidates", () => {
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
});
