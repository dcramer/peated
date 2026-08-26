import { db } from "@peated/server/db";
import { entityEvents } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /entities/:entity/events", () => {
  test("creates a dated history event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const data = await routerClient.entities.events.create(
      {
        entity: entity.id,
        kind: "generic",
        date: "1983-05",
        description: "Production moved to a new still house.",
        sourceUrl: "https://example.com/history",
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      entityId: entity.id,
      kind: "generic",
      date: "1983-05",
      description: "Production moved to a new still house.",
      sourceUrl: "https://example.com/history",
    });
    expect(
      await db.query.entityEvents.findFirst({
        where: eq(entityEvents.id, data.id),
      }),
    ).toBeDefined();
  });

  test("records an acquisition", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const owner = await fixtures.Entity({ kind: "company" });

    const data = await routerClient.entities.events.create(
      {
        entity: entity.id,
        kind: "acquired",
        date: "2004-11-15",
        newOwnerId: owner.id,
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      kind: "acquired",
      date: "2004-11-15",
      newOwnerId: owner.id,
    });
  });

  test("rejects an invalid partial date", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.events.create(
        {
          entity: entity.id,
          kind: "closed",
          date: "1983-02-30",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("requires details for a generic event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.events.create(
        {
          entity: entity.id,
          kind: "generic",
          date: "1983",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("requires a new owner for an acquisition", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.events.create(
        {
          entity: entity.id,
          kind: "acquired",
          date: "1983",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("requires moderator privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.events.create(
        {
          entity: entity.id,
          kind: "closed",
          date: "1983",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
