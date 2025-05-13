import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { routerClient } from "../router";

describe("PUT /bottle-aliases/:name", () => {
  test("requires mod", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias();
    const user = await fixtures.User();

    const err = await waitError(
      routerClient.bottleAliasUpdate(
        {
          name: alias.name,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("updates alias", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias({ ignored: false });
    const user = await fixtures.User({ admin: true });

    await routerClient.bottleAliasUpdate(
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
