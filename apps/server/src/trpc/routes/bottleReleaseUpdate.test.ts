import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { CASK_FILLS, CASK_SIZE_IDS, CASK_TYPE_IDS } from "../../constants";
import { db } from "../../db";
import { bottleReleases, changes } from "../../db/schema";
import waitError from "../../lib/test/waitError";
import { createCaller } from "../router";

describe("bottleReleaseUpdate", () => {
  it("requires authentication", async () => {
    const caller = createCaller({ user: null });
    const err = await waitError(
      caller.bottleReleaseUpdate({
        release: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  it("requires moderator access", async ({ defaults }) => {
    const caller = createCaller({ user: defaults.user });
    const err = await waitError(
      caller.bottleReleaseUpdate({
        release: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  it("updates a release with new attributes", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle({
      name: "Test Bottle",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      statedAge: null,
    });

    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
      releaseYear: 2020,
      vintageYear: 2010,
    });

    const data = {
      release: release.id,
      edition: "Batch 2",
      statedAge: 12,
      abv: 48.0,
      releaseYear: 2021,
      vintageYear: 2009,
    };

    const result = await caller.bottleReleaseUpdate(data);

    // Verify key properties of the response
    expect(result).toMatchObject({
      bottleId: bottle.id,
      statedAge: 12,
      abv: 48.0,
      releaseYear: 2021,
      vintageYear: 2009,
      edition: "Batch 2",
      fullName:
        "Ardbeg Test Bottle - Batch 2 - 12-year-old - 2021 Release - 2009 Vintage - 48.0% ABV",
      name: "Test Bottle - Batch 2 - 12-year-old - 2021 Release - 2009 Vintage - 48.0% ABV",
    });

    // Verify the release was updated in the database
    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(updatedRelease).toBeDefined();
    expect(updatedRelease.bottleId).toBe(bottle.id);
    expect(updatedRelease.edition).toBe("Batch 2");
    expect(updatedRelease.statedAge).toBe(12);
    expect(updatedRelease.abv).toBe(48.0);
    expect(updatedRelease.releaseYear).toBe(2021);
    expect(updatedRelease.vintageYear).toBe(2009);
    expect(updatedRelease.fullName).toBe(
      "Ardbeg Test Bottle - Batch 2 - 12-year-old - 2021 Release - 2009 Vintage - 48.0% ABV",
    );
    expect(updatedRelease.name).toBe(
      "Test Bottle - Batch 2 - 12-year-old - 2021 Release - 2009 Vintage - 48.0% ABV",
    );

    // Verify change record was created
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle_release"),
          eq(changes.objectId, release.id),
        ),
      );

    expect(change).toBeDefined();
    expect(change.type).toBe("update");
    expect(change.displayName).toBe(updatedRelease.fullName);
  });

  it("throws error if release not found", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const err = await waitError(
      caller.bottleReleaseUpdate({
        release: 999999,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: Release not found.]`);
  });

  it("throws error if release statedAge differs from bottle statedAge", async function ({
    fixtures,
  }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle({
      name: "10",
      statedAge: 10,
    });

    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
    });

    const err = await waitError(
      caller.bottleReleaseUpdate({
        release: release.id,
        statedAge: 12, // Different from bottle's statedAge
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[TRPCError: Release statedAge must match bottle's statedAge.]`,
    );
  });

  it("throws error if release with same attributes exists", async function ({
    fixtures,
  }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle({
      name: "Test Bottle",
      statedAge: null,
    });

    // Create initial release
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
      releaseYear: 2020,
      vintageYear: 2010,
    });

    // Create another release with different attributes
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 2",
      statedAge: 12,
      abv: 48.0,
      releaseYear: 2021,
      vintageYear: 2009,
    });

    // Try to update release2 to match release1's attributes
    const err = await waitError(
      caller.bottleReleaseUpdate({
        release: release2.id,
        edition: "Batch 1",
        statedAge: 10,
        abv: 46.0,
        releaseYear: 2020,
        vintageYear: 2010,
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[TRPCError: A release with these attributes already exists.]`,
    );
  });

  it("updates cask information", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      abv: 46.0,
    });

    const data = {
      release: release.id,
      caskType: "bourbon" as (typeof CASK_TYPE_IDS)[number],
      caskSize: "hogshead" as (typeof CASK_SIZE_IDS)[number],
      caskFill: "1st_fill" as (typeof CASK_FILLS)[number],
      singleCask: true,
      caskStrength: true,
    };

    const result = await caller.bottleReleaseUpdate(data);

    expect(result.caskType).toBe("bourbon");
    expect(result.caskSize).toBe("hogshead");
    expect(result.caskFill).toBe("1st_fill");
    expect(result.singleCask).toBe(true);
    expect(result.caskStrength).toBe(true);

    // Verify the release was updated in the database
    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(updatedRelease.caskType).toBe("bourbon");
    expect(updatedRelease.caskSize).toBe("hogshead");
    expect(updatedRelease.caskFill).toBe("1st_fill");
    expect(updatedRelease.singleCask).toBe(true);
    expect(updatedRelease.caskStrength).toBe(true);
  });

  it("updates description and tasting notes", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      abv: 46.0,
    });

    const data = {
      release: release.id,
      description: "Updated description",
      tastingNotes: {
        nose: "Updated nose",
        palate: "Updated palate",
        finish: "Updated finish",
      },
    };

    const result = await caller.bottleReleaseUpdate(data);

    expect(result.description).toBe("Updated description");
    expect(result.tastingNotes).toEqual({
      nose: "Updated nose",
      palate: "Updated palate",
      finish: "Updated finish",
    });

    // Verify the release was updated in the database
    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(updatedRelease.description).toBe("Updated description");
    expect(updatedRelease.tastingNotes).toEqual({
      nose: "Updated nose",
      palate: "Updated palate",
      finish: "Updated finish",
    });
  });

  it("throws error if release name matches bottle name", async function ({
    fixtures,
  }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle({
      name: "Test Bottle",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });

    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
    });

    const err = await waitError(
      caller.bottleReleaseUpdate({
        release: release.id,
        edition: null,
        abv: null,
        releaseYear: null,
        vintageYear: null,
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[TRPCError: Release name cannot be the same as the bottle name.]`,
    );
  });

  it("performs partial updates correctly", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle({
      name: "Test Bottle",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      statedAge: null,
    });

    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 10,
      abv: 46.0,
      releaseYear: 2020,
      vintageYear: 2010,
    });

    // Only update some fields
    const data = {
      release: release.id,
      abv: 48.0,
      releaseYear: 2021,
    };

    const result = await caller.bottleReleaseUpdate(data);

    // Verify only specified fields were updated
    expect(result.abv).toBe(48.0);
    expect(result.releaseYear).toBe(2021);
    // Verify other fields remained unchanged
    expect(result.edition).toBe("Batch 1");
    expect(result.statedAge).toBe(10);
    expect(result.vintageYear).toBe(2010);

    // Verify the release was updated in the database
    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(updatedRelease.abv).toBe(48.0);
    expect(updatedRelease.releaseYear).toBe(2021);
    expect(updatedRelease.edition).toBe("Batch 1");
    expect(updatedRelease.statedAge).toBe(10);
    expect(updatedRelease.vintageYear).toBe(2010);
  });

  it("updates image URL", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      abv: 46.0,
      releaseYear: null,
      vintageYear: null,
      statedAge: null,
    });

    const data = {
      release: release.id,
      imageUrl: "https://example.com/new-image.jpg",
    };

    const result = await caller.bottleReleaseUpdate(data);

    expect(result.imageUrl).toBe("https://example.com/new-image.jpg");

    // Verify the release was updated in the database
    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(updatedRelease.imageUrl).toBe("https://example.com/new-image.jpg");
  });

  it("rolls back transaction on error", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const bottle = await fixtures.Bottle({
      name: "Test Bottle",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });

    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      abv: 46.0,
    });

    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 2",
      abv: 46.0,
    });

    // Try to update with invalid data that will cause a conflict
    const err = await waitError(
      caller.bottleReleaseUpdate({
        release: release2.id,
        edition: "Batch 1", // Same as existing
        abv: 46.0, // Same as existing
        // This should trigger the duplicate check
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[TRPCError: A release with these attributes already exists.]`,
    );

    // Verify the release was not changed
    const [unchangedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(unchangedRelease.edition).toBe("Batch 1");
    expect(unchangedRelease.abv).toBe(46.0);
    expect(unchangedRelease.fullName).toBe(release.fullName);
  });
});
