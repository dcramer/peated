import { db } from "@peated/server/db";
import { entityAliases, entityReferences } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("DELETE /entities/:entity/aliases/:alias", () => {
  test("deletes the alias but keeps the reference", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const alias = await fixtures.EntityAlias({
      entityId: entity.id,
      name: "Shared Name",
    });
    const reference = await fixtures.EntityReference({
      entityId: entity.id,
      name: "Shared Name",
    });

    await routerClient.entities.aliases.delete(
      { entity: entity.id, alias: alias.id },
      { context: { user } },
    );

    expect(
      await db.query.entityAliases.findFirst({
        where: eq(entityAliases.id, alias.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.entityReferences.findFirst({
        where: eq(entityReferences.name, reference.name),
      }),
    ).toMatchObject({ entityId: entity.id });
  });
});
