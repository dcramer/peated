import { db } from "@peated/server/db";
import { changes, entityAliases } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { desc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /entities/:entity/aliases", () => {
  test("creates entity alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Wolfburn" });

    const data = await routerClient.entities.aliases.create(
      {
        entity: entity.id,
        name: "Wolfburn Distillery",
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      name: "Wolfburn Distillery",
      isCanonical: false,
    });

    const [alias] = await db
      .select()
      .from(entityAliases)
      .where(eq(entityAliases.name, "Wolfburn Distillery"));
    expect(alias?.entityId).toBe(entity.id);

    const [change] = await db
      .select()
      .from(changes)
      .where(eq(changes.objectId, entity.id))
      .orderBy(desc(changes.id))
      .limit(1);
    expect(change).toMatchObject({
      objectType: "entity",
      type: "update",
      data: {
        alias: "Wolfburn Distillery",
      },
    });
  });

  test("is idempotent when alias already belongs to entity", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const alias = await fixtures.EntityAlias({
      entityId: entity.id,
      name: "Existing Alias",
    });

    const data = await routerClient.entities.aliases.create(
      {
        entity: entity.id,
        name: "Existing Alias",
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      name: alias.name,
      isCanonical: false,
    });
  });

  test("claims an unbound alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityAlias({
      entityId: null,
      name: "Unbound Alias",
    });

    await routerClient.entities.aliases.create(
      {
        entity: entity.id,
        name: "Unbound Alias",
      },
      { context: { user } },
    );

    const [alias] = await db
      .select()
      .from(entityAliases)
      .where(eq(entityAliases.name, "Unbound Alias"));
    expect(alias?.entityId).toBe(entity.id);
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.entities.aliases.create({
        entity: 1,
        name: "Test Alias",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.aliases.create(
        {
          entity: entity.id,
          name: "Test Alias",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects alias owned by another entity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const otherEntity = await fixtures.Entity();
    await fixtures.EntityAlias({
      entityId: otherEntity.id,
      name: "Conflicting Alias",
    });

    const err = await waitError(() =>
      routerClient.entities.aliases.create(
        {
          entity: entity.id,
          name: "Conflicting Alias",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Alias already belongs to another entity (${otherEntity.id}).]`,
    );
  });

  test("returns 404 for missing entity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.entities.aliases.create(
        {
          entity: 123456789,
          name: "Test Alias",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
