import { db } from "@peated/server/db";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("DELETE /entities/:entity/events/:event", () => {
  test("deletes an event", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [{ id: 3 }, { id: 4, date: "1990" }],
      sections: [
        {
          key: "lead",
          heading: null,
          eraEventId: null,
          writtenBy: "pipeline",
          sentences: [
            { text: "It closed in 1983.", factIds: ["event:3"] },
            { text: "It reopened in 1990.", factIds: ["event:4"] },
          ],
        },
      ],
    });
    const event = { id: 3 };

    await expect(
      routerClient.entities.events.delete(
        { entity: entity.id, event: event.id },
        { context: { user } },
      ),
    ).resolves.toEqual({});

    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.events.map(({ id }) => id)).toEqual([4]);
    // Sentences that cited the removed item go with it.
    expect(about?.document.sections[0]?.sentences).toEqual([
      { text: "It reopened in 1990.", factIds: ["event:4"] },
    ]);
  });

  test("does not delete an event through another entity", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const otherEntity = await fixtures.Entity();
    await fixtures.EntityAbout({ entityId: entity.id, events: [{ id: 3 }] });
    const event = { id: 3 };

    const err = await waitError(() =>
      routerClient.entities.events.delete(
        { entity: otherEntity.id, event: event.id },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: History item not found.]`);
  });
});
