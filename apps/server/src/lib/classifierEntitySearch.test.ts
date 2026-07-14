import { searchClassifierEntities } from "@peated/server/lib/classifierEntitySearch";

describe("searchClassifierEntities", () => {
  test("returns a shorter contained distillery name as a candidate", async ({
    fixtures,
  }) => {
    const distillery = await fixtures.Entity({
      name: "Copperfield",
      type: ["distiller"],
    });

    const results = await searchClassifierEntities({
      query: "Atlas Copperfield Distillery Co.",
      type: "distiller",
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
      type: ["distiller"],
    });
    const specific = await fixtures.Entity({
      name: "Northstar Distillery",
      type: ["distiller"],
    });

    const results = await searchClassifierEntities({
      query: "Northstar Distillery Co.",
      type: "distiller",
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
      names.map((name) => fixtures.Entity({ name, type: ["distiller"] })),
    );

    const results = await searchClassifierEntities({
      query: "Qzxalpha Qzxbeta Qzxgamma Distillery Company",
      type: "distiller",
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
      type: ["distiller"],
    });
    const specific = await fixtures.Entity({
      name: "Needle Producer",
      type: ["distiller"],
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
      type: "distiller",
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
          type: ["distiller"],
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
      type: ["distiller"],
    });

    const results = await searchClassifierEntities({
      query: `${misleading.map((_, index) => `Alias${index}`).join(" ")} Needle Producer Company`,
      type: "distiller",
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
      type: ["distiller"],
    });
    await fixtures.EntityAlias({ entityId: entity.id, name: "Zed Alias" });
    await fixtures.EntityAlias({
      entityId: entity.id,
      name: "Alpha Very Long Specific Producer Alias",
    });

    const results = await searchClassifierEntities({
      query: "Zed Alias Alpha Very Long Specific Producer Alias Company",
      type: "distiller",
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
