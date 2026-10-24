import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities/:entity/events", () => {
  test("lists history in date order", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "reopened",
      date: "2001-04-03",
    });
    await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "opened",
      date: "1898",
    });
    await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "closed",
      date: "1983-05",
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
