import { db } from "@peated/server/db";
import { entityAliases } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /entity-aliases/:name", () => {
  test("unbinds alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const alias = await fixtures.EntityAlias({ entityId: entity.id });

    const data = await routerClient.entities.aliases.delete(
      {
        name: alias.name,
      },
      { context: { user } },
    );
    expect(data).toEqual({});

    const [newAlias] = await db
      .select()
      .from(entityAliases)
      .where(eq(entityAliases.name, alias.name));
    expect(newAlias).toBeDefined();
    expect(newAlias.entityId).toBeNull();
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.entities.aliases.delete({
        name: "test-alias",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();
    const alias = await fixtures.EntityAlias({ entityId: entity.id });

    const err = await waitError(() =>
      routerClient.entities.aliases.delete(
        {
          name: alias.name,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns 404 for non-existent alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.entities.aliases.delete(
        {
          name: "non-existent-alias",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Alias not found.]`);
  });

  test("prevents deleting canonical name", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Test Entity" });

    // Create an alias with the same name as the entity
    const alias = await fixtures.EntityAlias({
      entityId: entity.id,
      name: entity.name,
    });

    const err = await waitError(() =>
      routerClient.entities.aliases.delete(
        {
          name: alias.name,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: BAD_REQUEST: Cannot delete canonical name]
    `);
  });
});
