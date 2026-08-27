import { EntityResolutionSchema } from "@peated/bottle-classifier/internal/types";
import { searchClassifierEntities } from "@peated/server/lib/classifierEntitySearch";

describe("searchClassifierEntities", () => {
  test("returns global exact and contained Entity matches", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Existing Release Imprint",
      kind: "distillery",
    });

    const results = await searchClassifierEntities({
      query: "Existing Release Imprint",
      limit: 5,
    });

    expect(results).toContainEqual(
      expect.objectContaining({
        entityId: entity.id,
        source: expect.arrayContaining(["exact"]),
      }),
    );

    const fuzzyResults = await searchClassifierEntities({
      query: "Existing Release Imprint Company",
      limit: 5,
    });

    expect(fuzzyResults.map((result) => result.entityId)).toContain(entity.id);
  });

  test("returns schema-valid full-text entity matches", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Ichiro’s Malt",
      kind: "brand",
    });

    const results = await searchClassifierEntities({
      query: "Ichiro's Malt",
      limit: 10,
    });

    expect(
      results.map((result) => EntityResolutionSchema.parse(result)),
    ).toEqual(results);
    expect(results).toContainEqual(
      expect.objectContaining({
        entityId: entity.id,
        kind: "brand",
      }),
    );
  });

  test("filters Entity-classifier search by kind", async ({ fixtures }) => {
    const brand = await fixtures.Entity({
      name: "Kindfilter Brand",
      kind: "brand",
    });
    const company = await fixtures.Entity({
      name: "Kindfilter Company",
      kind: "company",
    });

    const results = await searchClassifierEntities({
      query: "Kindfilter",
      kind: "company",
      limit: 5,
    });

    expect(results.map(({ entityId }) => entityId)).toContain(company.id);
    expect(results.map(({ entityId }) => entityId)).not.toContain(brand.id);
    expect(results.every(({ kind }) => kind === "company")).toBe(true);
  });

  test("returns a shorter contained distillery name as a candidate", async ({
    fixtures,
  }) => {
    const distillery = await fixtures.Entity({
      name: "Copperfield",
      kind: "distillery",
    });

    const results = await searchClassifierEntities({
      query: "Atlas Copperfield Distillery Co.",
      limit: 5,
    });

    expect(results).toContainEqual(
      expect.objectContaining({
        entityId: distillery.id,
        source: expect.arrayContaining(["contained"]),
      }),
    );
  });

  test("ranks the more specific contained producer name first", async ({
    fixtures,
  }) => {
    const broad = await fixtures.Entity({
      name: "Northstar",
      kind: "distillery",
    });
    const specific = await fixtures.Entity({
      name: "Northstar Distillery",
      kind: "distillery",
    });

    const results = await searchClassifierEntities({
      query: "Northstar Distillery Co.",
      limit: 5,
    });

    expect(results.map((result) => result.entityId)).toEqual([
      specific.id,
      broad.id,
    ]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  test("ranks contained candidates before applying the result limit", async ({
    fixtures,
  }) => {
    const names = [
      "Qzxalpha",
      "Qzxbeta",
      "Qzxgamma",
      "Qzxdelta",
      "Qzxepsilon",
      "Qzxalpha Qzxbeta Qzxgamma Distillery",
    ];
    const created = await Promise.all(
      names.map((name) => fixtures.Entity({ name, kind: "distillery" })),
    );

    const results = await searchClassifierEntities({
      query: "Qzxalpha Qzxbeta Qzxgamma Distillery Company",
      limit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.entityId).toBe(created.at(-1)?.id);
  });

  test("deduplicates matching aliases before limiting contained entities", async ({
    fixtures,
  }) => {
    const aliasHeavy = await fixtures.Entity({
      name: "Crowd Holder",
      kind: "distillery",
    });
    const specific = await fixtures.Entity({
      name: "Needle Producer",
      kind: "distillery",
    });
    const aliases = Array.from(
      { length: 10 },
      (_, index) => `Very Long Crowd Alias Number ${index}`,
    );
    await Promise.all(
      aliases.map((name) =>
        fixtures.EntityAlias({ entityId: aliasHeavy.id, name }),
      ),
    );

    const results = await searchClassifierEntities({
      query: `${aliases.join(" ")} Needle Producer Company`,
      limit: 2,
    });

    expect(results).toContainEqual(
      expect.objectContaining({
        entityId: specific.id,
        source: expect.arrayContaining(["contained"]),
      }),
    );
  });

  test("does not rank alias matches by unrelated canonical name length", async ({
    fixtures,
  }) => {
    const misleading = await Promise.all(
      Array.from({ length: 5 }, async (_, index) => {
        const entity = await fixtures.Entity({
          name: `Unrelated Extremely Long Canonical Distillery Name ${index}`,
          kind: "distillery",
        });
        await fixtures.EntityAlias({
          entityId: entity.id,
          name: `Alias${index}`,
        });
        return entity;
      }),
    );
    const specific = await fixtures.Entity({
      name: "Needle Producer",
      kind: "distillery",
    });

    const results = await searchClassifierEntities({
      query: `${misleading.map((_, index) => `Alias${index}`).join(" ")} Needle Producer Company`,
      limit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.entityId).toBe(specific.id);
  });

  test("returns the longest matching alias used for contained scoring", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Canonical Producer",
      kind: "distillery",
    });
    await fixtures.EntityAlias({ entityId: entity.id, name: "Zed Alias" });
    await fixtures.EntityAlias({
      entityId: entity.id,
      name: "Alpha Very Long Specific Producer Alias",
    });

    const results = await searchClassifierEntities({
      query: "Zed Alias Alpha Very Long Specific Producer Alias Company",
      limit: 5,
    });

    expect(results).toContainEqual(
      expect.objectContaining({
        entityId: entity.id,
        alias: "Alpha Very Long Specific Producer Alias",
      }),
    );
  });
});
