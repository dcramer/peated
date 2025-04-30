import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../trpc/router";

test("get country by slug", async ({ fixtures }) => {
  const country = await fixtures.Country();

  const caller = createCaller({ user: null });
  const data = await caller.countryBySlug(country.slug);
  expect(data.id).toEqual(country.id);
});

test("errors on invalid badge", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.countryBySlug("nochance"));
  expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
});
