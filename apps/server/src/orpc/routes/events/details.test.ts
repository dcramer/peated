import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /events/:event", () => {
  test("returns event details", async ({ fixtures }) => {
    const event = await fixtures.Event();

    const data = await routerClient.events.details({
      event: event.id,
    });

    expect(data.id).toEqual(event.id);
    expect(data.name).toEqual(event.name);
  });

  test("returns 404 for invalid event", async () => {
    const err = await waitError(
      routerClient.events.details({
        event: 12345,
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Event not found.]`);
  });
});
