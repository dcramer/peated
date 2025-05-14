import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /entities/:entity/categories", () => {
  test("lists categories for an entity", async ({ fixtures }) => {
    const entity = await fixtures.Entity();

    // Create bottles with different categories
    await fixtures.Bottle({
      brandId: entity.id,
      category: "bourbon",
    });
    await fixtures.Bottle({
      brandId: entity.id,
      category: "bourbon",
    });
    await fixtures.Bottle({
      brandId: entity.id,
      category: "single_malt",
    });

    const { results, totalCount } = await routerClient.entities.categories.list(
      {
        entity: entity.id,
      },
    );

    expect(results).toHaveLength(2);
    expect(results).toEqual(
      expect.arrayContaining([
        {
          category: "bourbon",
          count: 2,
        },
        {
          category: "single_malt",
          count: 1,
        },
      ]),
    );
    expect(totalCount).toBe(3);
  });

  test("lists categories for a distiller entity", async ({ fixtures }) => {
    const distiller = await fixtures.Entity({ type: ["distiller"] });
    const bottle = await fixtures.Bottle({
      distillerIds: [distiller.id],
      category: "rye",
    });

    const { results, totalCount } = await routerClient.entities.categories.list(
      {
        entity: distiller.id,
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      category: "rye",
      count: 1,
    });
  });

  test("returns empty results for an entity with no bottles", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity();

    const { results, totalCount } = await routerClient.entities.categories.list(
      {
        entity: entity.id,
      },
    );

    expect(results).toHaveLength(0);
    expect(totalCount).toBe(0);
  });

  test("throws error for invalid entity", async () => {
    const err = await waitError(() =>
      routerClient.entities.categories.list({
        entity: 999999,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
