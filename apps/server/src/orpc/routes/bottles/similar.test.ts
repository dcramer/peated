import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/:bottle/similar", () => {
  test("lists similar bottles", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Brand" });
    const distiller = await fixtures.Entity({ name: "Distiller" });

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
      edition: "Other Vintage",
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
      brandId: (await fixtures.Entity({ name: "Other Brand" })).id,
      distillerIds: [distiller.id],
      name: "Main Bottle",
      statedAge: 12,
    });

    const { results } = await routerClient.bottles.similar({
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

    const { results } = await routerClient.bottles.similar({
      bottle: bottle.id,
    });

    expect(results.length).toBe(0);
  });

  test("throws error for non-existent bottle", async () => {
    const err = await waitError(
      routerClient.bottles.similar({
        bottle: 999999,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });
});
