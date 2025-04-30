import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../trpc/router";

test("requires mod", async ({ fixtures }) => {
  const alias = await fixtures.BottleAlias();
  const caller = createCaller({
    user: await fixtures.User(),
  });
  const err = await waitError(
    caller.bottleAliasUpdate({
      name: alias.name,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("updates alias", async ({ fixtures }) => {
  const alias = await fixtures.BottleAlias({ ignored: false });

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  await caller.bottleAliasUpdate({
    name: alias.name,
    ignored: true,
  });

  const [newAlias] = await db
    .select()
    .from(bottleAliases)
    .where(eq(bottleAliases.name, alias.name));

  expect(newAlias).toBeDefined();
  expect(newAlias.ignored).toBe(true);
});
