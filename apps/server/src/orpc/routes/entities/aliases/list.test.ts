import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/:entity/aliases", () => {
  test("includes the short name and marks it", async ({ fixtures }) => {
    const entity = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
    });
    const alias = await fixtures.EntityAlias({
      entityId: entity.id,
      name: "The Society",
    });

    const { results } = await routerClient.entities.aliases.list({
      entity: entity.id,
    });

    expect(results).toEqual([
      {
        id: null,
        name: "SMWS",
        isShortName: true,
        createdAt: null,
      },
      {
        id: alias.id,
        name: "The Society",
        isShortName: false,
        createdAt: alias.createdAt.toISOString(),
      },
    ]);
  });

  test("does not repeat a short name equal to the Entity name", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Wolfburn",
      shortName: "Wolfburn",
    });
    const { results } = await routerClient.entities.aliases.list({
      entity: entity.id,
    });
    expect(results).toEqual([]);
  });
});
