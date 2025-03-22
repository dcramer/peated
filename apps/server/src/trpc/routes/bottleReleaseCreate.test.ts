import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db";
import { bottleReleases } from "../../db/schema";
import waitError from "../../lib/test/waitError";
import { createCaller } from "../router";

describe("bottleReleaseCreate", () => {
  it("creates a new release for a bottle without statedAge", async function ({
    fixtures,
    defaults,
  }) {
    const caller = createCaller({ user: defaults.user });

    const bottle = await fixtures.Bottle({
      name: "Urquhart",
      statedAge: null,
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });

    const data = {
      bottleId: bottle.id,
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

    const result = await caller.bottleReleaseCreate(data);

    // Verify key properties of the response
    expect(result).toMatchObject({
      bottleId: bottle.id,
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
      "Ardbeg Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV",
    );
    expect(release.name).toBe(
      "Urquhart - Batch 1 - 10-year-old - 2023 Release - 2013 Vintage - 46.1% ABV",
    );
  });

  it("creates a new release for a bottle with statedAge", async function ({
    fixtures,
    defaults,
  }) {
    const caller = createCaller({ user: defaults.user });

    const bottle = await fixtures.Bottle({
      name: "10",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      statedAge: 10,
    });

    const data = {
      bottleId: bottle.id,
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

    const result = await caller.bottleReleaseCreate(data);

    // Verify key properties of the response
    expect(result).toMatchObject({
      bottleId: bottle.id,
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
      "Ardbeg 10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV", // No age in name since it's in bottle
    );
    expect(release.name).toBe(
      "10 - Batch 1 - 2023 Release - 2013 Vintage - 46.0% ABV", // No age in name since it's in bottle
    );
  });

  it("throws error if release statedAge differs from bottle statedAge", async function ({
    fixtures,
    defaults,
  }) {
    const caller = createCaller({ user: defaults.user });

    const bottle = await fixtures.Bottle({
      name: "10",
      statedAge: 10,
    });

    const data = {
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 12, // Different from bottle's statedAge
      abv: 46.0,
    };

    const err = await waitError(caller.bottleReleaseCreate(data));
    expect(err).toMatchInlineSnapshot(
      `[TRPCError: Release statedAge must match bottle's statedAge.]`,
    );
  });

  it("throws error if bottle not found", async function ({ defaults }) {
    const caller = createCaller({ user: defaults.user });

    const data = {
      bottleId: 999999,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
    };

    const err = await waitError(caller.bottleReleaseCreate(data));
    expect(err).toMatchInlineSnapshot(`[TRPCError: Bottle not found.]`);
  });

  it("throws error if release with same attributes exists", async function ({
    fixtures,
    defaults,
  }) {
    const caller = createCaller({ user: defaults.user });

    const bottle = await fixtures.Bottle({
      name: "10",
      statedAge: null,
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
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
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
    };

    const err = await waitError(caller.bottleReleaseCreate(data));
    expect(err).toMatchInlineSnapshot(
      `[TRPCError: A release with these attributes already exists.]`,
    );
  });

  it("handles null values in uniqueness check", async function ({
    fixtures,
    defaults,
  }) {
    const caller = createCaller({ user: defaults.user });

    const bottle = await fixtures.Bottle({
      statedAge: null,
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
      bottleId: bottle.id,
      edition: "A",
    };

    const err = await waitError(caller.bottleReleaseCreate(data));
    expect(err).toMatchInlineSnapshot(
      `[TRPCError: A release with these attributes already exists.]`,
    );
  });
});
