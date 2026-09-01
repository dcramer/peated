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
    const country = await fixtures.Country();

    const newEvent = await routerClient.events.create(
      {
        name: "International Whiskey Day",
        dateStart: "2024-03-27",
        country: country.id,
        address: "Across Scotland",
      },
      { context: { user: adminUser } },
    );

    expect(newEvent.name).toEqual("International Whiskey Day");
    expect(newEvent.dateStart).toEqual("2024-03-27");
    expect(newEvent.country?.id).toEqual(country.id);
    expect(newEvent.address).toEqual("Across Scotland");
  });

  test("rejects an end date before the start date", async ({ fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(
      routerClient.events.create(
        {
          name: "Backwards Festival",
          dateStart: "2027-05-10",
          dateEnd: "2027-05-09",
        },
        { context: { user: adminUser } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("rejects a duplicate event", async ({ fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });
    await fixtures.Event({
      name: "Fèis Ìle",
      dateStart: "2027-05-28",
    });

    const err = await waitError(
      routerClient.events.create(
        {
          name: "FÈIS ÌLE",
          dateStart: "2027-05-28",
        },
        { context: { user: adminUser } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Event already exists.]`);
  });
});
