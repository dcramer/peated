import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("get tasting by id", async ({ fixtures }) => {
  const tasting = await fixtures.Tasting();

  const caller = createCaller({ user: null });
  const data = await caller.tastingById(tasting.id);
  expect(data.id).toEqual(tasting.id);
});

test("errors on invalid tasting", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.tastingById(1));
  expect(err).toMatchInlineSnapshot();
});
