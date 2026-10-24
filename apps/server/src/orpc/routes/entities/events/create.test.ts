import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

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
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.events).toEqual([
      expect.objectContaining({ id: data.id, writtenBy: "person" }),
    ]);
    expect(about?.document.sources.map(({ url }) => url)).toEqual([
      "https://example.com/history",
    ]);
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
        sourceUrl: "https://example.com/acquired",
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

  test("rejects an owner that was deleted", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    // A deleted Entity leaves a tombstone with no replacement.
    await db
      .insert(entityTombstones)
      .values({ entityId: 987_654, newEntityId: null });

    const err = await waitError(() =>
      routerClient.entities.events.create(
        {
          entity: entity.id,
          kind: "acquired",
          date: "1925",
          newOwnerId: 987_654,
          sourceUrl: "https://example.com/history",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Linked entity 987654 does not exist.]`,
    );
  });

  test("rejects an owner merged into an Entity later deleted", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    // 987_655 was merged into 987_656, which was then deleted.
    await db.insert(entityTombstones).values([
      { entityId: 987_655, newEntityId: 987_656 },
      { entityId: 987_656, newEntityId: null },
    ]);

    const err = await waitError(() =>
      routerClient.entities.events.create(
        {
          entity: entity.id,
          kind: "acquired",
          date: "1925",
          newOwnerId: 987_655,
          sourceUrl: "https://example.com/history",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Linked entity 987655 does not exist.]`,
    );
  });

  test("requires a source", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.events.create(
        { entity: entity.id, kind: "closed", date: "1983" },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Add a source URL for this history item.]`,
    );
  });

  test("rejects text longer than the About document stores", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.events.create(
        {
          entity: entity.id,
          kind: "generic",
          date: "1983",
          description: "x".repeat(1001),
          sourceUrl: "https://example.com/history",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchObject({ code: "BAD_REQUEST" });
    expect(await getEntityAbout(db, entity.id)).toBeNull();
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
