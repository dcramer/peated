import { eq } from "drizzle-orm";
import { db } from "../../db";
import { entities } from "../../db/schema";
import { createCaller } from "../router";

test("deletes entity", async ({ fixtures }) => {
  const user = await fixtures.User({ admin: true });
  const entity = await fixtures.Entity();

  const caller = createCaller({ user });
  const data = await caller.entityDelete(entity.id);
  expect(data).toEqual({});

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entity.id));
  expect(newEntity).toBeUndefined();
});

test("cannot delete without admin", async ({ fixtures }) => {
  const user = await fixtures.User({ mod: true });
  const entity = await fixtures.Entity({ createdById: user.id });

  const caller = createCaller({ user });
  expect(() => caller.entityDelete(entity.id)).rejects.toThrowError(
    /UNAUTHORIZED/,
  );
});
