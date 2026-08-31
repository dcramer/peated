import { db } from "@peated/server/db";
import { entityReferences } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("DELETE /entity-references/:name", () => {
  test("unassigns the reference", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const reference = await fixtures.EntityReference({ entityId: entity.id });

    const data = await routerClient.entities.references.delete(
      {
        name: reference.name,
      },
      { context: { user } },
    );
    expect(data).toEqual({});

    const [newReference] = await db
      .select()
      .from(entityReferences)
      .where(eq(entityReferences.name, reference.name));
    expect(newReference).toBeDefined();
    expect(newReference.entityId).toBeNull();
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.entities.references.delete({
        name: "test-reference",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();
    const reference = await fixtures.EntityReference({ entityId: entity.id });

    const err = await waitError(() =>
      routerClient.entities.references.delete(
        {
          name: reference.name,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns 404 for non-existent reference", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.entities.references.delete(
        {
          name: "non-existent-reference",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Reference not found.]`);
  });

  test("prevents removing current Entity names", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({
      name: "The Test Entity",
      shortName: "Test",
    });
    await fixtures.EntityReference({ entityId: entity.id, name: "Test" });
    await fixtures.EntityReference({
      entityId: entity.id,
      name: "Test Entity",
    });

    for (const name of [entity.name, entity.shortName!, "Test Entity"]) {
      const error = await waitError(() =>
        routerClient.entities.references.delete(
          { name },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({
        message: "Current Entity names cannot be removed.",
      });
    }
  });
});
