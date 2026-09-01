import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/:entity/resolve", () => {
  test("returns the Entity ID and primary kind", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "company" });

    await expect(
      routerClient.entities.resolve({ entity: entity.id }),
    ).resolves.toEqual({ id: entity.id, kind: "company" });
  });

  test("resolves an Entity tombstone", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await db.insert(entityTombstones).values({
      entityId: 999,
      newEntityId: entity.id,
    });

    await expect(
      routerClient.entities.resolve({ entity: 999 }),
    ).resolves.toEqual({ id: entity.id, kind: "distillery" });
  });

  test("rejects a missing Entity", async () => {
    const error = await waitError(
      routerClient.entities.resolve({ entity: 999_999 }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
