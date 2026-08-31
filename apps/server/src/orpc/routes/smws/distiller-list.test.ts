import { db } from "@peated/server/db";
import { entityAliases } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /smws/distillers", () => {
  test("lists distillers by canonical name or alias", async ({ fixtures }) => {
    const cascadeHollow = await fixtures.Entity({
      name: "Cascade Hollow",
    });
    await db
      .delete(entityAliases)
      .where(eq(entityAliases.entityId, cascadeHollow.id));

    const nikka = await fixtures.Entity({
      name: "Nikka",
    });
    await fixtures.EntityAlias({
      entityId: nikka.id,
      name: "Nikka Coffey Grain",
    });

    await fixtures.Entity({ name: "Not an SMWS distiller" });

    const user = await fixtures.User({ mod: true });
    const { results } = await routerClient.smws.distillerList(
      {},
      { context: { user } },
    );

    expect(new Set(results.map((result) => result.id))).toEqual(
      new Set([cascadeHollow.id, nikka.id]),
    );
  });
});
