import { createCaller } from "../router";

test("get flight by id", async ({ fixtures }) => {
  const flight = await fixtures.Flight();

  const caller = createCaller({ user: null });
  const data = await caller.flightById(flight.publicId);
  expect(data.id).toEqual(flight.publicId);
});

test("errors on invalid flight", async () => {
  const caller = createCaller({ user: null });
  expect(() => caller.flightById("123")).rejects.toThrowError(/NOT_FOUND/);
});
