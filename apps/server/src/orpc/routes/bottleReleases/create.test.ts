import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  changes,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("POST /bottle-releases", () => {
  it("creates a new release for a bottle without statedAge", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "Urquhart",
      statedAge: null,
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });

    const data = {
      bottle: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.1,
      releaseYear: 2023,
      vintageYear: 2013,
      singleCask: false,
      caskStrength: false,
      caskType: "bourbon" as const,
      caskSize: "hogshead" as const,
      caskFill: "refill" as const,
    };

    const result = await routerClient.bottleReleases.create(data, {
      context: { user: defaults.user },
    });

    // Verify key properties of the response
    expect(result).toMatchObject({
      statedAge: 10,
      abv: 46.1,
      releaseYear: 2023,
      vintageYear: 2013,
      edition: "Batch 1",
      fullName:
        "Ardbeg Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV - Refill - Bourbon - Hogshead",
      name: "Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV - Refill - Bourbon - Hogshead",
      hasTasted: false,
      isFavorite: false,
      totalTastings: 0,
      avgRating: null,
      suggestedTags: [],
    });

    // Verify the release was created in the database
    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.id));

    expect(release).toBeDefined();
    expect(release.bottleId).toBe(bottle.id);
    expect(release.edition).toBe("Batch 1");
    expect(release.statedAge).toBe(10);
    expect(release.abv).toBe(46.1);
    expect(release.releaseYear).toBe(2023);
    expect(release.vintageYear).toBe(2013);
    expect(release.fullName).toBe(
      "Ardbeg Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV - Refill - Bourbon - Hogshead",
    );
    expect(release.name).toBe(
      "Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV - Refill - Bourbon - Hogshead",
    );

    const releaseAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, release.fullName),
    });
    expect(releaseAlias).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });

    // Verify numReleases was incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(1);

    // Verify change record was created
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle_release"),
          eq(changes.objectId, release.id),
          eq(changes.createdById, defaults.user.id),
        ),
      );

    expect(change).toBeDefined();
    expect(change.type).toBe("add");
    expect(change.displayName).toBe(release.fullName);
  });

  it("creates a new release for a bottle with statedAge", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "10",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      statedAge: 10,
    });

    const data = {
      bottle: bottle.id,
      edition: "Batch 1",
      abv: 46.0,
      releaseYear: 2023,
      vintageYear: 2013,
      singleCask: false,
      caskStrength: false,
      caskType: "bourbon" as const,
      caskSize: "hogshead" as const,
      caskFill: "refill" as const,
    };

    const result = await routerClient.bottleReleases.create(data, {
      context: { user: defaults.user },
    });

    // Verify key properties of the response
    expect(result).toMatchObject({
      statedAge: 10,
      abv: 46.0,
      releaseYear: 2023,
      vintageYear: 2013,
      edition: "Batch 1",
      fullName:
        "Ardbeg 10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV - Refill - Bourbon - Hogshead",
      name: "10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV - Refill - Bourbon - Hogshead",
      hasTasted: false,
      isFavorite: false,
      totalTastings: 0,
      avgRating: null,
      suggestedTags: [],
    });

    // Verify the release was created in the database
    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.id));

    expect(release).toBeDefined();
    expect(release.bottleId).toBe(bottle.id);
    expect(release.edition).toBe("Batch 1");
    expect(release.statedAge).toBe(10); // Should use bottle's statedAge
    expect(release.abv).toBe(46.0);
    expect(release.releaseYear).toBe(2023);
    expect(release.vintageYear).toBe(2013);
    expect(release.fullName).toBe(
      "Ardbeg 10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV - Refill - Bourbon - Hogshead", // No age in name since it's in bottle
    );
    expect(release.name).toBe(
      "10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV - Refill - Bourbon - Hogshead", // No age in name since it's in bottle
    );

    // Verify numReleases was incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(1);

    // Verify change record was created
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle_release"),
          eq(changes.objectId, release.id),
          eq(changes.createdById, defaults.user.id),
        ),
      );

    expect(change).toBeDefined();
    expect(change.type).toBe("add");
    expect(change.displayName).toBe(release.fullName);
  });

  it("throws error if release statedAge differs from bottle statedAge", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "10",
      statedAge: 10,
    });

    const data = {
      bottle: bottle.id,
      edition: "Batch 1",
      statedAge: 12, // Different from bottle's statedAge
      abv: 46.0,
    };

    const err = await waitError(() =>
      routerClient.bottleReleases.create(data, {
        context: { user: defaults.user },
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Release statedAge must match bottle's statedAge.]`,
    );

    // Verify numReleases was not incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(0);
  });

  it("throws error if bottle not found", async function ({ defaults }) {
    const data = {
      bottle: 999999,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
    };

    const err = await waitError(() =>
      routerClient.bottleReleases.create(data, {
        context: { user: defaults.user },
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  it("creates exact releases without a classification field", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "Private Selection",
      brandId: (await fixtures.Entity({ name: "Maker's Mark" })).id,
    });

    const result = await routerClient.bottleReleases.create(
      {
        bottle: bottle.id,
        edition: "S2B13",
        singleCask: true,
        abv: 55.1,
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(result.edition).toBe("S2B13");
    expect(result.singleCask).toBe(true);

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.id));

    expect(release.edition).toBe("S2B13");
    expect(release.singleCask).toBe(true);
  });

  it("creates cask-only releases with distinct canonical names", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "Distillery Reserve",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      statedAge: null,
    });

    const result = await routerClient.bottleReleases.create(
      {
        bottle: bottle.id,
        edition: null,
        statedAge: null,
        abv: null,
        releaseYear: null,
        vintageYear: null,
        singleCask: true,
        caskStrength: true,
        caskType: "tawny_port",
        caskSize: "hogshead",
        caskFill: "1st_fill",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(result.fullName).toBe(
      "Ardbeg Distillery Reserve - Single Cask - Cask Strength - 1st Fill - Tawny Port - Hogshead",
    );
  });

  it("allows releases that differ only by cask identity", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "Distillery Reserve",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      statedAge: null,
    });

    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: null,
      statedAge: null,
      abv: 46,
      caskType: "bourbon",
      caskSize: "hogshead",
      caskFill: "refill",
      singleCask: false,
      caskStrength: false,
    });

    const result = await routerClient.bottleReleases.create(
      {
        bottle: bottle.id,
        edition: null,
        statedAge: null,
        abv: 46,
        releaseYear: null,
        vintageYear: null,
        singleCask: false,
        caskStrength: false,
        caskType: "oloroso",
        caskSize: "hogshead",
        caskFill: "refill",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(result.caskType).toBe("oloroso");
    expect(result.fullName).toBe(
      "Ardbeg Distillery Reserve - 46.0% ABV - Refill - Oloroso - Hogshead",
    );
  });

  it("throws error if release with same attributes exists", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "10",
      statedAge: null,
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      numReleases: 1,
    });

    // Create initial release
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
      vintageYear: null,
      releaseYear: null,
    });

    // Try to create duplicate release
    const data = {
      bottle: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
    };

    const err = await waitError(() =>
      routerClient.bottleReleases.create(data, {
        context: { user: defaults.user },
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: A release with these attributes already exists.]`,
    );

    // Verify numReleases was not incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(1);
  });

  it("handles null values in uniqueness check", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      statedAge: null,
      numReleases: 1,
    });

    // Create initial release with null values
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      statedAge: null,
      vintageYear: null,
      releaseYear: null,
      edition: "A",
      abv: null,
    });

    // Try to create duplicate release with null values
    const data = {
      bottle: bottle.id,
      edition: "A",
    };

    const err = await waitError(() =>
      routerClient.bottleReleases.create(data, {
        context: { user: defaults.user },
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: A release with these attributes already exists.]`,
    );

    // Verify numReleases was not incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(1);
  });

  it("rejects creating a child release when the parent bottle still stores release details", async function ({
    fixtures,
    defaults,
  }) {
    const bottle = await fixtures.Bottle({
      name: "Mystery Distillery",
      edition: "1990 Release",
      releaseYear: 1990,
      abv: 43,
      vintageYear: 1978,
    });

    const err = await waitError(() =>
      routerClient.bottleReleases.create(
        {
          bottle: bottle.id,
          edition: "1991 Release",
          releaseYear: 1991,
          abv: 46,
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Bottle already stores specific release details on the parent record. A moderator must split or clear those bottle fields before adding child releases.]`,
    );

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(0);

    const releaseList = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.bottleId, bottle.id));
    expect(releaseList).toHaveLength(0);
  });
});
