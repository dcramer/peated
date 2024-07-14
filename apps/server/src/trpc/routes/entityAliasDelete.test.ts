import { entityAliases } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { createCaller } from "../router";

test("deletes alias", async ({ fixtures }) => {
  const user = await fixtures.User({ mod: true });
  const entity = await fixtures.Entity();
  const alias = await fixtures.EntityAlias({ entityId: entity.id });

  const caller = createCaller({ user });
  const data = await caller.entityAliasDelete(alias.name);
  expect(data).toEqual({});

  const [newAlias] = await db
    .select()
    .from(entityAliases)
    .where(eq(entityAliases.name, alias.name));
  expect(newAlias).toBeUndefined();
});

test("cannot delete without mod", async ({ fixtures }) => {
  const user = await fixtures.User();
  const entity = await fixtures.Entity();
  const alias = await fixtures.EntityAlias({ entityId: entity.id });

  const caller = createCaller({ user });
  const err = await waitError(caller.entityAliasDelete(alias.name));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});
