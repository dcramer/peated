import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bottleAliases,
  bottleGroups,
  catalogTargets,
  flightBottles,
} from "../../db/schema";

describe("catalog identity fixtures", () => {
  test("standard consumers use the Bottle exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    if (!exactTarget) throw new Error("Bottle fixture is missing exact target");
    const group = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, bottle.groupId as number),
    });

    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    const review = await fixtures.Review({ bottleId: bottle.id });
    const price = await fixtures.StorePrice({ bottleId: bottle.id });
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });
    const flight = await fixtures.Flight({ bottles: [bottle.id] });
    const [flightBottle] = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));

    expect(tasting.targetId).toBe(exactTarget.id);
    expect(review.targetId).toBe(exactTarget.id);
    expect(price.targetId).toBe(exactTarget.id);
    expect(alias.targetId).toBe(exactTarget.id);
    expect(flightBottle?.targetId).toBe(exactTarget.id);
    expect(group?.totalBottles).toBe(1);
  });

  test("legacy fixtures retain nullable group and target identity", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    const targets = await db
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.bottleId, bottle.id));
    const aliases = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, bottle.id));

    expect(bottle.groupId).toBeNull();
    expect(targets).toEqual([]);
    expect(aliases).toEqual([
      expect.objectContaining({ bottleId: bottle.id, targetId: null }),
    ]);
    expect(tasting.targetId).toBeNull();
  });

  test("StorePrice conflicts replace an existing target with null", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const externalSite = await fixtures.ExternalSite();
    const initial = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: externalSite.id,
      name: "Target replacement fixture",
      volume: 750,
    });
    const updated = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: null,
      externalSiteId: externalSite.id,
      name: initial.name,
      volume: initial.volume,
    });

    expect(updated.id).toBe(initial.id);
    expect(updated.targetId).toBeNull();
  });
});
