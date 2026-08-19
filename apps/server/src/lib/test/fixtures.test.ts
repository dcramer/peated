import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottlesToDistillers,
  changes,
  flightBottles,
  reviewArticles,
} from "../../db/schema";

describe("catalog identity fixtures", () => {
  test("standard consumers reference the Bottle directly", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const group = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, bottle.groupId as number),
    });

    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    const review = await fixtures.Review({ bottleId: bottle.id });
    const price = await fixtures.StorePrice({ bottleId: bottle.id });
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });
    const flight = await fixtures.Flight({ bottles: [bottle.id] });
    const [flightBottle, canonicalAlias, reviewArticle] = await Promise.all([
      db.query.flightBottles.findFirst({
        where: eq(flightBottles.flightId, flight.id),
      }),
      db.query.bottleAliases.findFirst({
        where: and(
          eq(bottleAliases.bottleId, bottle.id),
          eq(bottleAliases.name, bottle.fullName),
        ),
      }),
      db.query.reviewArticles.findFirst({
        where: eq(reviewArticles.id, review.articleId as number),
      }),
    ]);

    expect(tasting.bottleId).toBe(bottle.id);
    expect(review.bottleId).toBe(bottle.id);
    expect(review.sourceKey).toBe(reviewArticle?.canonicalUrl);
    expect(reviewArticle).toMatchObject({
      canonicalUrl: expect.any(String),
      externalSiteId: expect.any(Number),
    });
    expect(price.bottleId).toBe(bottle.id);
    expect(alias.bottleId).toBe(bottle.id);
    expect(canonicalAlias?.assignmentSource).toBe("canonical");
    expect(flightBottle?.bottleId).toBe(bottle.id);
    expect(group?.totalBottles).toBe(1);
  });

  test("explicit legacy fixtures retain pre-flattening group state", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    const aliases = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, bottle.id));

    expect(bottle.groupId).toBeNull();
    expect(aliases).toEqual([
      expect.objectContaining({
        bottleId: bottle.id,
        assignmentSource: "legacy",
      }),
    ]);
    expect(tasting.bottleId).toBe(bottle.id);
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

    const [group, alias, audit, groupDistillers, memberDistillers] =
      await Promise.all([
        db.query.bottleGroups.findFirst({
          where: eq(bottleGroups.id, first.groupId as number),
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
    expect(alias).toMatchObject({
      bottleId: member.id,
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
  });

  test("StorePrice preserves an explicitly unresolved Bottle", async ({
    fixtures,
  }) => {
    const externalSite = await fixtures.ExternalSite();
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: externalSite.id,
      name: "Unresolved Bottle fixture",
      volume: 750,
    });

    expect(price.bottleId).toBeNull();
  });
});
