import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /bottles/:bottle/similar", () => {
  test("lists similar bottles", async ({ fixtures }) => {
    const brand = await fixtures.Entity();
    const distiller = await fixtures.Entity();

    const bottle1 = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Main Bottle",
      statedAge: 12,
      category: "bourbon",
    });

    // Should find - same brand, same name but different vintage
    const bottle2 = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Main Bottle",
      statedAge: 10,
      category: "bourbon",
    });

    // Should find - same brand, similar age
    const bottle3 = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Different Name",
      statedAge: 14,
      category: "bourbon",
    });

    // Should NOT find - different brand
    await fixtures.Bottle({
      brandId: (await fixtures.Entity()).id,
      distillerIds: [distiller.id],
      name: "Main Bottle",
      statedAge: 12,
    });

    const { results } = await routerClient.similarBottleList({
      bottle: bottle1.id,
    });

    expect(results.length).toBe(2);
    expect(results.map((r) => r.id).sort()).toEqual(
      [bottle2.id, bottle3.id].sort(),
    );
  });

  test("returns empty when no similar bottles", async ({ fixtures }) => {
    const brand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Unique Bottle",
    });

    const { results } = await routerClient.similarBottleList({
      bottle: bottle.id,
    });

    expect(results.length).toBe(0);
  });

  test("throws error for non-existent bottle", async () => {
    await expect(
      routerClient.similarBottleList({
        bottle: 999999,
      }),
    ).rejects.toThrow("Bottle not found.");
  });
});
