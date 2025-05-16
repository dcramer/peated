import { routerClient } from "@peated/server/orpc/router";

describe("GET /flights", () => {
  test("returns public flights", async ({ fixtures }) => {
    const flight = await fixtures.Flight({ public: true });
    const privateFlights = await fixtures.Flight({ public: false });

    const data = await routerClient.flights.list({});

    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toEqual(flight.publicId);
    expect(data.rel.nextCursor).toBeNull();
    expect(data.rel.prevCursor).toBeNull();
  });

  test("returns private flights for owner", async ({ fixtures }) => {
    const user = await fixtures.User();
    const flight = await fixtures.Flight({
      public: false,
      createdById: user.id,
    });

    const data = await routerClient.flights.list({}, { context: { user } });

    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toEqual(flight.publicId);
  });

  test("returns all flights for mod with none filter", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const publicFlight = await fixtures.Flight({ public: true });
    const privateFlight = await fixtures.Flight({ public: false });

    const data = await routerClient.flights.list(
      { filter: "none" },
      { context: { user } },
    );

    expect(data.results).toHaveLength(2);
    expect(data.results.map((f) => f.id).sort()).toEqual(
      [publicFlight.publicId, privateFlight.publicId].sort(),
    );
  });

  test("filters by query", async ({ fixtures }) => {
    const flight1 = await fixtures.Flight({
      name: "Test Flight 1",
      public: true,
    });
    const flight2 = await fixtures.Flight({
      name: "Another Flight",
      public: true,
    });

    const data = await routerClient.flights.list({ query: "Test" });

    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toEqual(flight1.publicId);
  });
});
