import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

const lead = {
  key: "lead",
  heading: null,
  eraEventId: null,
  sentences: [{ text: "It opened in 1819.", factIds: ["event:1"] }],
};

/** An Entity whose description no change records a person writing. */
async function unknownOriginEntity(fixtures: typeof Fixtures) {
  const entity = await fixtures.Entity({ kind: "distillery" });
  await db
    .update(entities)
    .set({ description: "An older description.", descriptionSrc: null })
    .where(eq(entities.id, entity.id));
  await fixtures.EntityAbout({
    entityId: entity.id,
    events: [{ id: 1, kind: "opened", date: "1819" }],
    sections: [lead],
  });
  return entity;
}

async function readDescription(entityId: number) {
  const [entity] = await db
    .select({ description: entities.description })
    .from(entities)
    .where(eq(entities.id, entityId));
  return entity?.description;
}

describe("POST /admin/catalog/sync-entity-descriptions", () => {
  test("dry run lists descriptions that would change and changes none", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await unknownOriginEntity(fixtures);

    const result = await routerClient.admin.syncEntityDescriptions(
      { dryRun: true },
      { context: { user: admin } },
    );

    expect(result.updates).toEqual([
      {
        entityId: entity.id,
        name: entity.name,
        before: "An older description.",
        description: "It opened in 1819.",
      },
    ]);
    expect(await readDescription(entity.id)).toBe("An older description.");
  });

  test("sets descriptions from About leads and keeps a person's", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const replaced = await unknownOriginEntity(fixtures);
    const person = await fixtures.Entity({
      kind: "brand",
      description: "Written by a moderator.",
      descriptionSrc: "user",
    });
    await fixtures.EntityAbout({
      entityId: person.id,
      events: [{ id: 1, kind: "opened", date: "1819" }],
      sections: [lead],
    });

    const first = await routerClient.admin.syncEntityDescriptions(
      { limit: 1 },
      { context: { user: admin } },
    );
    const second = await routerClient.admin.syncEntityDescriptions(
      { afterId: first.nextAfterId!, limit: 1 },
      { context: { user: admin } },
    );

    expect(first).toMatchObject({ checked: 1, nextAfterId: replaced.id });
    expect(second).toMatchObject({ checked: 1, nextAfterId: null });
    expect([...first.updates, ...second.updates]).toHaveLength(1);
    expect(await readDescription(replaced.id)).toBe("It opened in 1819.");
    expect(await readDescription(person.id)).toBe("Written by a moderator.");
  });

  test("requires an administrator", async ({ fixtures }) => {
    const user = await fixtures.User();

    await expect(
      routerClient.admin.syncEntityDescriptions({}, { context: { user } }),
    ).rejects.toThrow();
  });
});
