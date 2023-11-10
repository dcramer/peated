import { eq } from "drizzle-orm";
import { db } from "../../db";
import { bottles } from "../../db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("deletes bottle", async () => {
  const user = await Fixtures.User({ admin: true });
  const bottle = await Fixtures.Bottle();

  const caller = appRouter.createCaller({ user });
  const data = await caller.bottleDelete(bottle.id);
  expect(data).toEqual({});

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(newBottle).toBeUndefined();
});

test("cannot delete without admin", async () => {
  const user = await Fixtures.User({ mod: true });
  const bottle = await Fixtures.Bottle({ createdById: user.id });

  const caller = appRouter.createCaller({ user });
  expect(() => caller.bottleDelete(bottle.id)).rejects.toThrowError(
    /UNAUTHORIZED/,
  );
});
