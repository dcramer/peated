import { db } from "@peated/server/db";
import { changes, entityReferences } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { desc, eq } from "drizzle-orm";

describe("POST /entities/:entity/references", () => {
  test("creates entity reference", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Wolfburn" });

    const data = await routerClient.entities.references.create(
      {
        entity: entity.id,
        name: "Wolfburn Distillery",
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      name: "Wolfburn Distillery",
      isEntityName: false,
    });

    const [reference] = await db
      .select()
      .from(entityReferences)
      .where(eq(entityReferences.name, "Wolfburn Distillery"));
    expect(reference?.entityId).toBe(entity.id);

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
        reference: "Wolfburn Distillery",
      },
    });
  });

  test("is idempotent when reference already belongs to entity", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const reference = await fixtures.EntityReference({
      entityId: entity.id,
      name: "Existing Reference",
    });

    const data = await routerClient.entities.references.create(
      {
        entity: entity.id,
        name: "Existing Reference",
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      name: reference.name,
      isEntityName: false,
    });
  });

  test("assigns an unassigned reference", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityReference({
      entityId: null,
      name: "Unbound Reference",
    });

    await routerClient.entities.references.create(
      {
        entity: entity.id,
        name: "Unbound Reference",
      },
      { context: { user } },
    );

    const [reference] = await db
      .select()
      .from(entityReferences)
      .where(eq(entityReferences.name, "Unbound Reference"));
    expect(reference?.entityId).toBe(entity.id);
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.entities.references.create({
        entity: 1,
        name: "Test Reference",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.references.create(
        {
          entity: entity.id,
          name: "Test Reference",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects reference owned by another entity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const otherEntity = await fixtures.Entity();
    await fixtures.EntityReference({
      entityId: otherEntity.id,
      name: "Conflicting Reference",
    });

    const err = await waitError(() =>
      routerClient.entities.references.create(
        {
          entity: entity.id,
          name: "Conflicting Reference",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: This name belongs to Entity ${otherEntity.id}.]`,
    );
  });

  test("returns 404 for missing entity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.entities.references.create(
        {
          entity: 123456789,
          name: "Test Reference",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
