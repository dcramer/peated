import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../trpc/router";

test("get badge by id", async ({ fixtures }) => {
  const badge = await fixtures.Badge();

  const caller = createCaller({ user: null });
  const data = await caller.badgeById(badge.id);
  expect(data.id).toEqual(badge.id);
});

test("errors on invalid badge", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.badgeById(1));
  expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
});
