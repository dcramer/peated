import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /entities/:entity/aliases", () => {
  test("lists entity aliases", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ name: "Foo" });
    await fixtures.EntityAlias({
      entityId: entity.id,
      name: "Foo Bar",
    });

    const { results } = await routerClient.entities.aliases.list({
      entity: entity.id,
    });

    expect(results.length).toEqual(2);
    expect(results[0].name).toEqual("Foo");
    expect(results[0].isCanonical).toEqual(true);
    expect(results[1].name).toEqual("Foo Bar");
    expect(results[1].isCanonical).toEqual(false);
  });
});
