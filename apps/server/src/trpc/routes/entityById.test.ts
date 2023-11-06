import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("get entity by id", async () => {
  const brand = await Fixtures.Entity();

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.entityById(brand.id);
  expect(data.id).toEqual(brand.id);
});

test("errors on invalid entity", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.entityById(1)).rejects.toThrowError(/NOT_FOUND/);
});
