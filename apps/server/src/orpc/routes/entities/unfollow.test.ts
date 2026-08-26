import { db } from "@peated/server/db";
import { entityFollows } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /entities/:entity/follow", () => {
  test("requires authentication", async ({ fixtures }) => {
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.unfollow({ entity: entity.id }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects an unknown entity", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.entities.unfollow(
        { entity: 999999999 },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });

  test("does not remove another user's follow", async ({
    defaults,
    fixtures,
  }) => {
    const entity = await fixtures.Entity();
    const otherUser = await fixtures.User();
    await db.insert(entityFollows).values([
      { userId: defaults.user.id, entityId: entity.id },
      { userId: otherUser.id, entityId: entity.id },
    ]);

    await expect(
      routerClient.entities.unfollow(
        { entity: entity.id },
        { context: { user: defaults.user } },
      ),
    ).resolves.toEqual({ following: false });

    const rows = await db
      .select()
      .from(entityFollows)
      .where(eq(entityFollows.entityId, entity.id));
    expect(rows).toEqual([
      expect.objectContaining({
        userId: otherUser.id,
        entityId: entity.id,
      }),
    ]);
  });

  test("allows repeated unfollow requests", async ({ defaults, fixtures }) => {
    const entity = await fixtures.Entity();

    await expect(
      routerClient.entities.unfollow(
        { entity: entity.id },
        { context: { user: defaults.user } },
      ),
    ).resolves.toEqual({ following: false });
    await expect(
      routerClient.entities.unfollow(
        { entity: entity.id },
        { context: { user: defaults.user } },
      ),
    ).resolves.toEqual({ following: false });

    const rows = await db
      .select()
      .from(entityFollows)
      .where(
        and(
          eq(entityFollows.userId, defaults.user.id),
          eq(entityFollows.entityId, entity.id),
        ),
      );
    expect(rows).toHaveLength(0);
  });
});
