import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/:entity/references", () => {
  test("lists entity references", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ name: "Foo" });
    await fixtures.EntityReference({
      entityId: entity.id,
      name: "Foo Bar",
    });

    const { results } = await routerClient.entities.references.list({
      entity: entity.id,
    });

    expect(results.length).toEqual(2);
    expect(results[0].name).toEqual("Foo");
    expect(results[0].isEntityName).toEqual(true);
    expect(results[1].name).toEqual("Foo Bar");
    expect(results[1].isEntityName).toEqual(false);
  });
});
