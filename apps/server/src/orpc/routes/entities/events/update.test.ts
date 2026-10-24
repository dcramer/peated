import { db } from "@peated/server/db";
import { entityEvents } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PATCH /entities/:entity/events/:event", () => {
  test("updates an event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const owner = await fixtures.Entity({ kind: "company" });
    const event = await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "acquired",
      date: "2001",
      newOwnerId: owner.id,
    });

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
    expect(
      await db.query.entityEvents.findFirst({
        where: eq(entityEvents.id, event.id),
      }),
    ).toMatchObject({ kind: "closed", newOwnerId: null });
  });

  test("validates the complete updated event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const event = await fixtures.EntityEvent({ entityId: entity.id });

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
});
