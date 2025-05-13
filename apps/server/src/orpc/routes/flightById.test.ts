import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("get flight by id", async ({ fixtures }) => {
  const flight = await fixtures.Flight();

  const caller = createCaller({ user: null });
  const data = await caller.flightById(flight.publicId);
  expect(data.id).toEqual(flight.publicId);
});

test("errors on invalid flight", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.flightById("123"));
  expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
});
