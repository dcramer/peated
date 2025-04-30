import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../trpc/router";

test("get event by id", async ({ fixtures }) => {
  const event = await fixtures.Event();

  const caller = createCaller({ user: null });
  const data = await caller.eventById(event.id);
  expect(data.id).toEqual(event.id);
});

test("errors on invalid event", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.eventById(1));
  expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
});
