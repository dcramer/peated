import { db } from "@peated/server/db";
import { bottleReleases, bottles, changes } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("POST /bottle-releases", () => {
  it("creates a new release for a bottle without statedAge", async ({
    fixtures,
    defaults,
  }) => {
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
        "Ardbeg Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV",
      name: "Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV",
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
      "Ardbeg Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV"
    );
    expect(release.name).toBe(
      "Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV"
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
          eq(changes.createdById, defaults.user.id)
        )
      );

    expect(change).toBeDefined();
    expect(change.type).toBe("add");
    expect(change.displayName).toBe(release.fullName);
  });

  it("creates a new release for a bottle with statedAge", async ({
    fixtures,
    defaults,
  }) => {
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
      fullName: "Ardbeg 10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV",
      name: "10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV",
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
      "Ardbeg 10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV" // No age in name since it's in bottle
    );
    expect(release.name).toBe(
      "10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV" // No age in name since it's in bottle
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
          eq(changes.createdById, defaults.user.id)
        )
      );

    expect(change).toBeDefined();
    expect(change.type).toBe("add");
    expect(change.displayName).toBe(release.fullName);
  });

  it("throws error if release statedAge differs from bottle statedAge", async ({
    fixtures,
    defaults,
  }) => {
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
      })
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Release statedAge must match bottle's statedAge.]`
    );

    // Verify numReleases was not incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(0);
  });

  it("throws error if bottle not found", async ({ defaults }) => {
    const data = {
      bottle: 999999,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
    };

    const err = await waitError(() =>
      routerClient.bottleReleases.create(data, {
        context: { user: defaults.user },
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  it("throws error if release with same attributes exists", async ({
    fixtures,
    defaults,
  }) => {
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
      })
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: A release with these attributes already exists.]`
    );

    // Verify numReleases was not incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(1);
  });

  it("handles null values in uniqueness check", async ({
    fixtures,
    defaults,
  }) => {
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
      })
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: A release with these attributes already exists.]`
    );

    // Verify numReleases was not incremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.numReleases).toBe(1);
  });
});
