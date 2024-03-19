import { eq } from "drizzle-orm";
import { db } from "../../db";
import { entities } from "../../db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("deletes entity", async () => {
  const user = await Fixtures.User({ admin: true });
  const entity = await Fixtures.Entity();

  const caller = createCaller({ user });
  const data = await caller.entityDelete(entity.id);
  expect(data).toEqual({});

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entity.id));
  expect(newEntity).toBeUndefined();
});

test("cannot delete without admin", async () => {
  const user = await Fixtures.User({ mod: true });
  const entity = await Fixtures.Entity({ createdById: user.id });

  const caller = createCaller({ user });
  expect(() => caller.entityDelete(entity.id)).rejects.toThrowError(
    /UNAUTHORIZED/,
  );
});
