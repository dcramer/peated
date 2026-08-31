import { db } from "@peated/server/db";
import {
  entityFollows,
  entityImages,
  entityTombstones,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
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

  test("returns images with the primary image first", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const actor = await getUserActor(await fixtures.User());
    await db.insert(entityImages).values([
      {
        entityId: entity.id,
        imageUrl: "/uploads/entities/secondary.webp",
        caption: null,
        isPrimary: false,
        createdByActorId: actor.id,
      },
      {
        entityId: entity.id,
        imageUrl: "/uploads/entities/primary.webp",
        caption: "Front gate",
        sourceUrl: "https://example.com/front-gate-photo",
        license: "CC BY 4.0",
        isPrimary: true,
        createdByActorId: actor.id,
      },
    ]);

    const data = await routerClient.entities.details({ entity: entity.id });

    expect(data.images).toHaveLength(2);
    expect(data.images[0]).toMatchObject({
      caption: "Front gate",
      sourceUrl: "https://example.com/front-gate-photo",
      license: "CC BY 4.0",
      isPrimary: true,
    });
    expect(data.images[0]?.imageUrl).toContain(
      "/uploads/entities/primary.webp",
    );
  });

  test("returns the current direct owner", async ({ fixtures }) => {
    const owner = await fixtures.Entity({ name: "Owner", kind: "company" });
    const entity = await fixtures.Entity({ ownerId: owner.id });

    const data = await routerClient.entities.details({ entity: entity.id });

    expect(data.owner).toEqual({
      id: owner.id,
      peatedId: formatPeatedId("entity", owner.id),
      name: owner.name,
    });
  });

  test("returns whether the current user follows the entity", async ({
    defaults,
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await db.insert(entityFollows).values({
      entityId: entity.id,
      userId: defaults.user.id,
    });

    const anonymousData = await routerClient.entities.details({
      entity: entity.id,
    });
    const userData = await routerClient.entities.details(
      { entity: entity.id },
      { context: { user: defaults.user } },
    );

    expect(anonymousData.isFollowing).toBe(false);
    expect(userData.isFollowing).toBe(true);
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
