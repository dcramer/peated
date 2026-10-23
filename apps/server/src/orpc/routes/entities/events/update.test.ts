import { db } from "@peated/server/db";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("PATCH /entities/:entity/events/:event", () => {
  test("updates an event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const owner = await fixtures.Entity({ kind: "company" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [{ id: 7, kind: "acquired", date: "2001", newOwnerId: owner.id }],
    });
    const event = { id: 7 };

    const data = await routerClient.entities.events.update(
      {
        entity: entity.id,
        event: event.id,
        kind: "closed",
        date: "2002-03",
        description: "Production stopped.",
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      kind: "closed",
      date: "2002-03",
      description: "Production stopped.",
      newOwnerId: null,
    });
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.events).toEqual([
      expect.objectContaining({
        id: 7,
        kind: "closed",
        newOwnerId: null,
        writtenBy: "person",
      }),
    ]);
  });

  test("validates the complete updated event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityAbout({ entityId: entity.id, events: [{ id: 3 }] });
    const event = { id: 3 };

    const err = await waitError(() =>
      routerClient.entities.events.update(
        {
          entity: entity.id,
          event: event.id,
          kind: "generic",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: A description is required when kind is generic.]`,
    );
  });

  test("rejects removing the only source", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityAbout({ entityId: entity.id, events: [{ id: 3 }] });

    const err = await waitError(() =>
      routerClient.entities.events.update(
        { entity: entity.id, event: 3, sourceUrl: null },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Event 3 needs a source.]`);
  });
});
