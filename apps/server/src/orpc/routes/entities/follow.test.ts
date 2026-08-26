import { db } from "@peated/server/db";
import { entityFollows } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PUT /entities/:entity/follow", () => {
  test("requires authentication", async ({ fixtures }) => {
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.follow({ entity: entity.id }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects an unknown entity", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.entities.follow(
        { entity: 999999999 },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });

  test("does not create duplicate follows", async ({ defaults, fixtures }) => {
    const entity = await fixtures.Entity();

    await expect(
      routerClient.entities.follow(
        { entity: entity.id },
        { context: { user: defaults.user } },
      ),
    ).resolves.toEqual({ following: true });
    await expect(
      routerClient.entities.follow(
        { entity: entity.id },
        { context: { user: defaults.user } },
      ),
    ).resolves.toEqual({ following: true });

    const rows = await db
      .select()
      .from(entityFollows)
      .where(
        and(
          eq(entityFollows.userId, defaults.user.id),
          eq(entityFollows.entityId, entity.id),
        ),
      );
    expect(rows).toHaveLength(1);
  });
});
