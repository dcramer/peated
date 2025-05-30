import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/:entity", () => {
  test("get entity by id", async ({ fixtures }) => {
    const brand = await fixtures.Entity();

    const data = await routerClient.entities.details({
      entity: brand.id,
    });
    expect(data.id).toEqual(brand.id);
  });

  test("errors on invalid entity", async () => {
    const err = await waitError(
      routerClient.entities.details({
        entity: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });

  test("gets entity with tombstone", async ({ fixtures }) => {
    const entity1 = await fixtures.Entity();
    await db.insert(entityTombstones).values({
      entityId: 999,
      newEntityId: entity1.id,
    });
    await fixtures.Bottle();

    const data = await routerClient.entities.details({
      entity: 999,
    });
    expect(data.id).toEqual(entity1.id);
  });
});
