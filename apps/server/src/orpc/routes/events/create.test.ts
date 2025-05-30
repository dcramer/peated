import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /events", () => {
  test("requires admin", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.events.create(
        {
          name: "International Whiskey Day",
          dateStart: "2024-03-27",
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates event", async ({ fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const newEvent = await routerClient.events.create(
      {
        name: "International Whiskey Day",
        dateStart: "2024-03-27",
      },
      { context: { user: adminUser } },
    );

    expect(newEvent.name).toEqual("International Whiskey Day");
    expect(newEvent.dateStart).toEqual("2024-03-27");
  });
});
