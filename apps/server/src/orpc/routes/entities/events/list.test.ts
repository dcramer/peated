import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/:entity/events", () => {
  test("shows a merged owner as the Entity it became", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const owner = await fixtures.Entity({ kind: "company" });
    const mergedOwner = await fixtures.Entity({ kind: "company" });
    await db
      .insert(entityTombstones)
      .values({ entityId: mergedOwner.id, newEntityId: owner.id });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "acquired", date: "1925", newOwnerId: mergedOwner.id },
      ],
    });

    const { results } = await routerClient.entities.events.list({
      entity: entity.id,
    });

    expect(results.map(({ newOwnerId }) => newOwnerId)).toEqual([owner.id]);
  });

  test("hides an acquisition by an owner merged into the Entity", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity();
    const mergedOwner = await fixtures.Entity({ kind: "company" });
    await db
      .insert(entityTombstones)
      .values({ entityId: mergedOwner.id, newEntityId: entity.id });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "opened", date: "1819" },
        { id: 2, kind: "acquired", date: "1925", newOwnerId: mergedOwner.id },
      ],
    });

    const { results } = await routerClient.entities.events.list({
      entity: entity.id,
    });
    const about = await routerClient.entities.about.details({
      entity: entity.id,
    });

    expect(results.map(({ kind }) => kind)).toEqual(["opened"]);
    expect(about?.events.map(({ kind }) => kind)).toEqual(["opened"]);
  });

  test("lists history in date order", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "reopened", date: "2001-04-03" },
        { id: 2, kind: "opened", date: "1898" },
        { id: 3, kind: "closed", date: "1983-05" },
        // Display rule: history without a source stays hidden.
        { id: 4, kind: "mothballed", date: "1990", citations: [] },
        // Newer kinds belong to the About page, not this list.
        { id: 5, kind: "renamed", date: "1969", name: "Brora" },
      ],
    });

    const { results } = await routerClient.entities.events.list({
      entity: entity.id,
    });

    expect(results.map(({ kind, date }) => ({ kind, date }))).toEqual([
      { kind: "opened", date: "1898" },
      { kind: "closed", date: "1983-05" },
      { kind: "reopened", date: "2001-04-03" },
    ]);
  });

  test("returns 404 for a missing entity", async () => {
    const err = await waitError(() =>
      routerClient.entities.events.list({ entity: 123456789 }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
