import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("PATCH /events/:event", () => {
  test("requires admin", async ({ fixtures }) => {
    const event = await fixtures.Event();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.events.update(
        {
          event: event.id,
          name: "Foobar",
        },
        { context: { user: modUser } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates event", async ({ fixtures }) => {
    const event = await fixtures.Event();
    const adminUser = await fixtures.User({ admin: true });

    const newEvent = await routerClient.events.update(
      {
        event: event.id,
        name: "Foobar",
      },
      { context: { user: adminUser } }
    );

    expect(newEvent).toBeDefined();
    expect(newEvent.name).toEqual("Foobar");
  });
});
