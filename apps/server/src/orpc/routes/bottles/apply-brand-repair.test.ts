import { db } from "@peated/server/db";
import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /bottles/:bottle/apply-brand-repair", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.applyBrandRepair(
        {
          bottle: 1,
          fromBrand: 1,
          toBrand: 2,
          distillery: null,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("repairs a bottle onto the target brand and preserves the source distillery", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const targetBrand = await fixtures.Entity({
      name: "Jura",
      type: ["brand"],
    });
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "12-year-old Single Malt Scotch Whisky",
      totalTastings: 10,
      createdById: mod.id,
    });

    const result = await routerClient.bottles.applyBrandRepair(
      {
        bottle: bottle.id,
        fromBrand: currentBrand.id,
        toBrand: targetBrand.id,
        distillery: currentBrand.id,
      },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      bottleId: bottle.id,
      distilleryAdded: true,
      status: "applied",
    });

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle?.brandId).toEqual(targetBrand.id);

    const distilleryLinks = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    expect(distilleryLinks).toEqual([
      expect.objectContaining({
        bottleId: bottle.id,
        distillerId: currentBrand.id,
      }),
    ]);
  });
});
