import { db } from "@peated/server/db";
import { bottleGroups, bottleTombstones } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { loadBadgeTastings } from "./identity";

describe("loadBadgeTastings", () => {
  test("uses independently complete Bottle-owned identity", async ({
    fixtures,
  }) => {
    const bottleBrand = await fixtures.Entity();
    const bottleBottler = await fixtures.Entity();
    const bottleDistiller = await fixtures.Entity();
    const groupBrand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      brandId: bottleBrand.id,
      bottlerId: bottleBottler.id,
      distillerIds: [bottleDistiller.id],
      statedAge: 12,
      category: "single_malt",
    });
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });

    await db
      .update(bottleGroups)
      .set({ brandId: groupBrand.id, statedAge: 18, category: "blend" })
      .where(eq(bottleGroups.id, bottle.groupId!));

    const [result] = await loadBadgeTastings(db, [tasting]);

    expect(result?.identity).toMatchObject({
      kind: "bottle",
      bottleId: bottle.id,
      statedAge: 12,
      category: "single_malt",
      brand: { id: bottleBrand.id },
      bottler: { id: bottleBottler.id },
      distillers: [{ id: bottleDistiller.id }],
    });
  });

  test("fails closed for a retired Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    await expect(loadBadgeTastings(db, [tasting])).rejects.toThrow(
      `references inactive Bottle ${bottle.id}`,
    );
  });
});
