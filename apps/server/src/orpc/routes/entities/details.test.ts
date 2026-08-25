import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/:entity", () => {
  test("get entity by id", async ({ fixtures }) => {
    const brand = await fixtures.Entity();

    const data = await routerClient.entities.details({
      entity: brand.id,
    });
    expect(data.id).toEqual(brand.id);
    expect(data.peatedId).toEqual(formatPeatedId("entity", brand.id));
    expect("createdBy" in data).toBe(false);
  });

  test("returns the Entity update timestamp", async ({ fixtures }) => {
    const createdAt = new Date("2020-01-01T00:00:00.000Z");
    const updatedAt = new Date("2025-06-01T00:00:00.000Z");
    const entity = await fixtures.Entity({ createdAt, updatedAt });

    const data = await routerClient.entities.details({ entity: entity.id });

    expect(data.createdAt).toBe(createdAt.toISOString());
    expect(data.updatedAt).toBe(updatedAt.toISOString());
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
