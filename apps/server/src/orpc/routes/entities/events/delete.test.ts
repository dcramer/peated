import { db } from "@peated/server/db";
import { entityEvents } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("DELETE /entities/:entity/events/:event", () => {
  test("deletes an event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const event = await fixtures.EntityEvent({ entityId: entity.id });

    await expect(
      routerClient.entities.events.delete(
        { entity: entity.id, event: event.id },
        { context: { user } },
      ),
    ).resolves.toEqual({});

    expect(
      await db.query.entityEvents.findFirst({
        where: eq(entityEvents.id, event.id),
      }),
    ).toBeUndefined();
  });

  test("does not delete an event through another entity", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const otherEntity = await fixtures.Entity();
    const event = await fixtures.EntityEvent({ entityId: entity.id });

    const err = await waitError(() =>
      routerClient.entities.events.delete(
        { entity: otherEntity.id, event: event.id },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: History item not found.]`);
  });
});
