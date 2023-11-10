import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("get store by id", async () => {
  const store = await Fixtures.Store();

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.storeById(store.id);
  expect(data.id).toEqual(store.id);
});

test("errors on invalid store", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.storeById(1)).rejects.toThrowError(/NOT_FOUND/);
});
