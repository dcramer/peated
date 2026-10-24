import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /admin/catalog/clear-entity-descriptions", () => {
  test("clears generated descriptions that are not the About lead", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const legacy = await fixtures.Entity({
      kind: "distillery",
      description: "A storied distillery.",
      descriptionSrc: "generated",
    });
    const written = await fixtures.Entity({
      kind: "distillery",
      description: "It opened in 1819.",
      descriptionSrc: "generated",
    });
    await fixtures.EntityAbout({
      entityId: written.id,
      events: [{ id: 1, kind: "opened", date: "1819" }],
      sections: [
        {
          key: "lead",
          heading: null,
          eraEventId: null,
          sentences: [{ text: "It opened in 1819.", factIds: ["event:1"] }],
        },
      ],
    });
    const person = await fixtures.Entity({
      kind: "brand",
      description: "Written by a moderator.",
      descriptionSrc: "user",
    });

    const result = await routerClient.admin.clearEntityDescriptions(
      {},
      { context: { user: admin } },
    );

    expect(result).toMatchObject({ cleared: 1, nextAfterId: null });
    const rows = await db
      .select({ id: entities.id, description: entities.description })
      .from(entities);
    const byId = new Map(rows.map((row) => [row.id, row.description]));
    expect(byId.get(legacy.id)).toBeNull();
    expect(byId.get(written.id)).toBe("It opened in 1819.");
    expect(byId.get(person.id)).toBe("Written by a moderator.");
    const [cleared] = await db
      .select({ descriptionSrc: entities.descriptionSrc })
      .from(entities)
      .where(eq(entities.id, legacy.id));
    expect(cleared?.descriptionSrc).toBeNull();
  });
});
