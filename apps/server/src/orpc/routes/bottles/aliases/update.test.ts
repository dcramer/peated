import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PUT /bottle-aliases/:name", () => {
  test("requires mod", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias();
    const user = await fixtures.User();

    const err = await waitError(
      routerClient.bottles.aliases.update(
        {
          name: alias.name,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
  });

  test("updates alias", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias({ ignored: false });
    const user = await fixtures.User({ admin: true });

    await routerClient.bottles.aliases.update(
      {
        name: alias.name,
        ignored: true,
      },
      { context: { user } },
    );

    const [newAlias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.name, alias.name));

    expect(newAlias).toBeDefined();
    expect(newAlias.ignored).toBe(true);
  });
});
