import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const event = await fixtures.Event();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const err = await waitError(
    caller.eventUpdate({
      id: event.id,
      name: "Foobar",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("updates event", async ({ fixtures }) => {
  const event = await fixtures.Event();

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const newEvent = await caller.eventUpdate({
    id: event.id,
    name: "Foobar",
  });

  expect(newEvent).toBeDefined();
  expect(newEvent.name).toEqual("Foobar");
});
