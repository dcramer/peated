import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { bottles } from "../../db/schema";
import { createCaller } from "../router";

test("deletes bottle", async ({ fixtures }) => {
  const user = await fixtures.User({ admin: true });
  const bottle = await fixtures.Bottle();

  const caller = createCaller({ user });
  const data = await caller.bottleDelete(bottle.id);
  expect(data).toEqual({});

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(newBottle).toBeUndefined();
});

test("cannot delete without admin", async ({ fixtures }) => {
  const user = await fixtures.User({ mod: true });
  const bottle = await fixtures.Bottle({ createdById: user.id });

  const caller = createCaller({ user });
  const err = await waitError(caller.bottleDelete(bottle.id));
  expect(err).toMatchInlineSnapshot();
});
