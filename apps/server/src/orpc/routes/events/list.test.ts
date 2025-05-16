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

    const { results } = await routerClient.events.list({
      onlyUpcoming: true,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(futureEvent.id);
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
