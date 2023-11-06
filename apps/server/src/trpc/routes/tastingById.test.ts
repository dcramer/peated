import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("get tasting by id", async () => {
  const tasting = await Fixtures.Tasting();

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.tastingById(tasting.id);
  expect(data.id).toEqual(tasting.id);
});

test("errors on invalid tasting", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.tastingById(1)).rejects.toThrowError(/NOT_FOUND/);
});
