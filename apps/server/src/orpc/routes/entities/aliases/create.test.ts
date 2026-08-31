import { db } from "@peated/server/db";
import { entityAliases, entityReferences } from "@peated/server/db/schema";
import { findEntityByExactNameOrReference } from "@peated/server/lib/db";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /entities/:entity/aliases", () => {
  test("creates an alias without a reference", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Wolfburn" });

    const result = await routerClient.entities.aliases.create(
      { entity: entity.id, name: "Wolfburn Distillery" },
      { context: { user } },
    );

    expect(result).toMatchObject({
      name: "Wolfburn Distillery",
      isShortName: false,
    });
    expect(
      await db.query.entityAliases.findFirst({
        where: eq(entityAliases.id, result.id),
      }),
    ).toMatchObject({ entityId: entity.id, name: "Wolfburn Distillery" });
    expect(
      await db.query.entityReferences.findFirst({
        where: eq(entityReferences.name, "Wolfburn Distillery"),
      }),
    ).toBeUndefined();
    expect(
      await findEntityByExactNameOrReference(db, "Wolfburn Distillery"),
    ).toBeNull();
  });

  test("allows the same alias on different Entities", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const first = await fixtures.Entity();
    const second = await fixtures.Entity();

    await routerClient.entities.aliases.create(
      { entity: first.id, name: "Shared Name" },
      { context: { user } },
    );
    await expect(
      routerClient.entities.aliases.create(
        { entity: second.id, name: "Shared Name" },
        { context: { user } },
      ),
    ).resolves.toMatchObject({ name: "Shared Name" });
  });

  test("rejects the Entity name and short name", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
    });

    for (const name of [entity.name, entity.shortName!]) {
      const error = await waitError(() =>
        routerClient.entities.aliases.create(
          { entity: entity.id, name },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({
        message: "This Entity already has that name.",
      });
    }
  });

  test("requires moderator privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();
    const error = await waitError(() =>
      routerClient.entities.aliases.create(
        { entity: entity.id, name: "Other Name" },
        { context: { user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
