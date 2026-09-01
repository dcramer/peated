import { routerClient } from "@peated/server/orpc/router";

describe("GET /events", () => {
  test("lists events", async ({ fixtures }) => {
    await fixtures.Event();
    await fixtures.Event();

    const { results } = await routerClient.events.list({
      onlyUpcoming: false,
    });
    expect(results.length).toBe(2);
  });

  test("filters by upcoming events", async ({ fixtures }) => {
    const pastEvent = await fixtures.Event({
      dateStart: "2020-01-01",
      dateEnd: "2020-01-02",
    });

    const futureData = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
    const futureEvent = await fixtures.Event({
      dateStart: futureData.toISOString(),
      dateEnd: futureData.toISOString(),
    });
    const farFutureEvent = await fixtures.Event({
      dateStart: "2090-01-01",
      dateEnd: "2090-01-02",
    });

    const { results } = await routerClient.events.list({
      onlyUpcoming: true,
    });

    expect(results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([futureEvent.id, farFutureEvent.id]),
    );

    const allEvents = await routerClient.events.list({
      onlyUpcoming: false,
    });
    expect(allEvents.results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([pastEvent.id, futureEvent.id, farFutureEvent.id]),
    );
  });

  test("sorts events by date", async ({ fixtures }) => {
    const event1 = await fixtures.Event({
      dateStart: "2030-01-01",
    });
    const event2 = await fixtures.Event({
      dateStart: "2030-02-01",
    });

    const { results } = await routerClient.events.list({
      sort: "date",
      onlyUpcoming: false,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(event1.id);
    expect(results[1].id).toBe(event2.id);
  });
});
