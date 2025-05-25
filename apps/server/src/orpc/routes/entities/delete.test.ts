import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /entities/:entity", () => {
  test("deletes entity", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity();

    const data = await routerClient.entities.delete(
      { entity: entity.id },
      { context: { user } },
    );
    expect(data).toEqual({});

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(newEntity).toBeUndefined();
  });

  test("cannot delete without admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ createdById: user.id });

    const err = await waitError(() =>
      routerClient.entities.delete(
        { entity: entity.id },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
