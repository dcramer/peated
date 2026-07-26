import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottlesToDistillers,
  catalogTargets,
  changes,
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
    const [flightBottle, canonicalAlias] = await Promise.all([
      db.query.flightBottles.findFirst({
        where: eq(flightBottles.flightId, flight.id),
      }),
      db.query.bottleAliases.findFirst({
        where: and(
          eq(bottleAliases.bottleId, bottle.id),
          eq(bottleAliases.name, bottle.fullName),
        ),
      }),
    ]);

    expect(tasting.targetId).toBe(exactTarget.id);
    expect(review.targetId).toBe(exactTarget.id);
    expect(price.targetId).toBe(exactTarget.id);
    expect(alias.targetId).toBe(exactTarget.id);
    expect(canonicalAlias?.assignmentSource).toBe("canonical");
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
      expect.objectContaining({
        bottleId: bottle.id,
        targetId: null,
        assignmentSource: "legacy",
      }),
    ]);
    expect(tasting.targetId).toBeNull();
  });

  test("group member fixtures materialize a complete active-group graph", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Fixture Group Brand" });
    const distiller = await fixtures.Entity({
      name: "Fixture Group Distiller",
    });
    const series = await fixtures.BottleSeries({
      name: "Fixture Group Series",
      brandId: brand.id,
    });
    const first = await fixtures.Bottle({
      name: "Fixture Expression",
      statedAge: 12,
      seriesId: series.id,
      category: "single_malt",
      brandId: brand.id,
      flavorProfile: "peated",
      distillerIds: [distiller.id],
    });
    const member = await fixtures.BottleGroupMember({
      groupId: first.groupId as number,
      edition: "Batch Two",
      releaseYear: 2025,
    });

    const [group, target, alias, audit, groupDistillers, memberDistillers] =
      await Promise.all([
        db.query.bottleGroups.findFirst({
          where: eq(bottleGroups.id, first.groupId as number),
        }),
        db.query.catalogTargets.findFirst({
          where: eq(catalogTargets.bottleId, member.id),
        }),
        db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.bottleId, member.id),
        }),
        db.query.changes.findFirst({
          where: and(
            eq(changes.objectId, member.id),
            eq(changes.objectType, "bottle"),
          ),
        }),
        db
          .select()
          .from(bottleGroupDistillers)
          .where(eq(bottleGroupDistillers.groupId, first.groupId as number)),
        db
          .select()
          .from(bottlesToDistillers)
          .where(eq(bottlesToDistillers.bottleId, member.id)),
      ]);

    expect(member).toMatchObject({
      groupId: first.groupId,
      name: "Fixture Expression - Batch Two - 2025 Release",
      fullName:
        "Fixture Group Brand Fixture Expression - Batch Two - 2025 Release",
      statedAge: 12,
      seriesId: series.id,
      category: "single_malt",
      brandId: brand.id,
      flavorProfile: "peated",
      edition: "Batch Two",
      releaseYear: 2025,
    });
    expect(group).toMatchObject({
      representativeBottleId: first.id,
      totalBottles: 2,
    });
    expect(target).toMatchObject({
      groupId: first.groupId,
      bottleId: member.id,
    });
    expect(alias).toMatchObject({
      bottleId: member.id,
      targetId: target?.id,
      name: member.fullName,
      assignmentSource: "canonical",
    });
    expect(audit).toMatchObject({
      objectId: member.id,
      objectType: "bottle",
      type: "add",
    });
    expect(groupDistillers).toEqual([
      { groupId: first.groupId, distillerId: distiller.id },
    ]);
    expect(memberDistillers).toEqual([
      { bottleId: member.id, distillerId: distiller.id },
    ]);

    const destination = await fixtures.Bottle();
    await db.insert(bottleGroupTombstones).values({
      groupId: first.groupId as number,
      newGroupId: destination.groupId as number,
      createdByActorId: first.createdByActorId,
    });

    await expect(
      fixtures.BottleGroupMember({
        groupId: first.groupId as number,
        edition: "Rejected Batch",
      }),
    ).rejects.toThrow(
      `BottleGroup fixture is retired (${first.groupId as number})`,
    );
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
