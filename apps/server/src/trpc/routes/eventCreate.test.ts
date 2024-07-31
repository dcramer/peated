import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const err = await waitError(
    caller.eventCreate({
      name: "International Whiskey Day",
      dateStart: "2024-03-27",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("triggers job", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const newEvent = await caller.eventCreate({
    name: "International Whiskey Day",
    dateStart: "2024-03-27",
  });

  expect(newEvent.name).toEqual("International Whiskey Day");
  expect(newEvent.dateStart).toEqual("2024-03-27");
});
