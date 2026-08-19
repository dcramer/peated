import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  flightBottles,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /bottles", () => {
  test("lists bottles", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Delicious Wood" });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({});

    expect(results.length).toBe(2);
    expect(results.every((result) => result.group?.id)).toBe(true);
  });

  test("lists bottles with query", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      query: "wood",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("treats search punctuation as plain text", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Triple Distilled" });
    await fixtures.Bottle({ name: "Triple Reserve" });

    const { results } = await routerClient.bottles.list({
      query: "Triple - Distilled",
      sort: "rank",
    });

    expect(results.map(({ id }) => id)).toEqual([bottle.id]);
  });

  test("resolves aliases through direct Bottle ownership", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Private Selection" });

    await db.insert(bottleAliases).values({
      bottleId: bottle.id,
      name: "Direct Bottle Alias",
      assignedByActorId: bottle.createdByActorId,
    });

    const { results } = await routerClient.bottles.list({
      query: "Direct Bottle Alias",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle.id);
    expect(results[0].group?.id).toBe(bottle.groupId);
  });

  test("resolves assigned aliases and excludes ignored or unresolved aliases", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Alias Boundary" });
    await db.insert(bottleAliases).values([
      {
        bottleId: bottle.id,
        name: "Assigned General Alias",
        assignedByActorId: bottle.createdByActorId,
      },
      {
        bottleId: bottle.id,
        name: "Ignored Exact Alias",
        ignored: true,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        bottleId: null,
        name: "Unresolved Retained Alias",
        assignedByActorId: bottle.createdByActorId,
      },
    ]);

    const [assignedResults, ignoredResults, unresolvedResults] =
      await Promise.all([
        routerClient.bottles.list({ query: "Assigned General Alias" }),
        routerClient.bottles.list({ query: "Ignored Exact Alias" }),
        routerClient.bottles.list({ query: "Unresolved Retained Alias" }),
      ]);

    expect(assignedResults.results.map(({ id }) => id)).toEqual([bottle.id]);
    expect(ignoredResults.results).toHaveLength(0);
    expect(unresolvedResults.results).toHaveLength(0);
  });

  test("excludes a retired Bottle", async ({ fixtures }) => {
    const retired = await fixtures.Bottle({ name: "Retired Bottle" });
    const replacement = await fixtures.Bottle({ name: "Replacement Bottle" });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    const { results } = await routerClient.bottles.list({ sort: "name" });

    expect(results.map((result) => result.id)).toEqual([replacement.id]);
  });

  test("keeps exact sibling Bottles distinct in list results", async ({
    fixtures,
  }) => {
    const first = await fixtures.Bottle({ name: "Sibling Batch" });
    const second = await fixtures.BottleGroupMember({
      groupId: first.groupId as number,
      edition: "Batch Two",
      releaseYear: 2026,
    });

    const { results } = await routerClient.bottles.list({
      brand: first.brandId,
      sort: "name",
    });

    expect(results.map((result) => result.id).sort((a, b) => a - b)).toEqual(
      [first.id, second.id].sort((a, b) => a - b),
    );
  });

  test("lists bottles with 'The' prefix", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "The Macallan" });
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      brandId: brand.id,
    });

    const { results } = await routerClient.bottles.list({
      query: "Macallan",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with distiller", async ({ fixtures }) => {
    const distiller1 = await fixtures.Entity();
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      distillerIds: [distiller1.id],
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      distiller: distiller1.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with brand", async ({ fixtures }) => {
    const brand1 = await fixtures.Entity();
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      brandId: brand1.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      brand: brand1.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with bottler", async ({ fixtures }) => {
    const bottler = await fixtures.Entity({
      type: ["bottler"],
    });
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      bottlerId: bottler.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      bottler: bottler.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with entity filter (brand)", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      brandId: entity.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      entity: entity.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with entity filter (bottler)", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      bottlerId: entity.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      entity: entity.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with entity filter (distiller)", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      distillerIds: [entity.id],
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      entity: entity.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with flavor profile filter", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Peated Whisky",
      flavorProfile: "peated",
    });
    await fixtures.Bottle({
      name: "Light Whisky",
      flavorProfile: "light_delicate",
    });
    await fixtures.Bottle({ name: "No Profile" });

    const { results } = await routerClient.bottles.list({
      flavorProfile: "peated",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with category filter", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Single Malt",
      category: "single_malt",
    });
    await fixtures.Bottle({
      name: "Bourbon",
      category: "bourbon",
    });
    await fixtures.Bottle({ name: "No Category" });

    const { results } = await routerClient.bottles.list({
      category: "single_malt",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with age filter", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "12 Year Old",
      statedAge: 12,
    });
    await fixtures.Bottle({
      name: "18 Year Old",
      statedAge: 18,
    });
    await fixtures.Bottle({ name: "No Age Statement" });

    const { results } = await routerClient.bottles.list({
      age: 12,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with cask type filter", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Bourbon Cask",
      caskType: "bourbon",
    });
    await fixtures.Bottle({
      name: "Sherry Cask",
      caskType: "oloroso",
    });
    await fixtures.Bottle({ name: "No Cask Type" });

    const { results } = await routerClient.bottles.list({
      caskType: "bourbon",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("filters tags by direct Bottle identity", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Tagged Bottle" });
    const bottle2 = await fixtures.Bottle({ name: "Other Bottle" });
    await fixtures.Tasting({
      bottleId: bottle2.id,
      tags: ["smoky", "peated"],
    });
    await fixtures.Tasting({
      bottleId: bottle1.id,
      tags: ["retained-only"],
    });

    const [targetMatch, retainedMatch] = await Promise.all([
      routerClient.bottles.list({ tag: "smoky" }),
      routerClient.bottles.list({ tag: "retained-only" }),
    ]);

    expect(targetMatch.results.map((result) => result.id)).toEqual([
      bottle2.id,
    ]);
    expect(retainedMatch.results.map((result) => result.id)).toEqual([
      bottle1.id,
    ]);
  });

  test("filters flights by direct Bottle identity", async ({ fixtures }) => {
    const flight = await fixtures.Flight({ name: "Exact target flight" });
    const retainedBottle = await fixtures.Bottle({
      name: "Flight member",
    });
    await fixtures.Bottle({
      name: "Unrelated Bottle",
    });
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: retainedBottle.id,
    });

    const { results } = await routerClient.bottles.list({
      flight: flight.publicId,
      sort: "name",
    });

    expect(results.map((result) => result.id)).toEqual([retainedBottle.id]);
  });

  test("returns empty results for an unknown flight", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Some Bottle" });

    const result = await routerClient.bottles.list({
      flight: "unknown-flight",
      cursor: 2,
    });

    expect(result).toEqual({
      results: [],
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    });
  });

  test("paginates exact flight members using Bottle list ordering", async ({
    fixtures,
  }) => {
    const members = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        fixtures.Bottle({
          name: `Flight Bottle ${index + 1}`,
          totalTastings: index + 1,
        }),
      ),
    );
    await fixtures.Bottle({
      name: "Outside flight",
      totalTastings: 100,
    });
    const flight = await fixtures.Flight({
      name: "Paginated flight",
      bottles: members.map((bottle) => bottle.id),
    });

    const page1 = await routerClient.bottles.list({
      flight: flight.publicId,
      limit: 2,
      cursor: 1,
      sort: "-tastings",
    });
    const page2 = await routerClient.bottles.list({
      flight: flight.publicId,
      limit: 2,
      cursor: 2,
      sort: "-tastings",
    });
    const page3 = await routerClient.bottles.list({
      flight: flight.publicId,
      limit: 2,
      cursor: 3,
      sort: "-tastings",
    });

    expect(page1.results.map((result) => result.id)).toEqual([
      members[4]!.id,
      members[3]!.id,
    ]);
    expect(page1.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(page2.results.map((result) => result.id)).toEqual([
      members[2]!.id,
      members[1]!.id,
    ]);
    expect(page2.rel).toEqual({ nextCursor: 3, prevCursor: 1 });
    expect(page3.results.map((result) => result.id)).toEqual([members[0]!.id]);
    expect(page3.rel).toEqual({ nextCursor: null, prevCursor: 2 });
  });

  test("lists bottles with query matching brand and name", async ({
    fixtures,
  }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood 10-year-old",
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      query: "wood 10",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with series", async ({ fixtures }) => {
    const series = await fixtures.BottleSeries({ name: "Limited Edition" });
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      seriesId: series.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      series: series.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  // Sorting tests
  test("sorts bottles by name ascending", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Singleton" });
    const bottle1 = await fixtures.Bottle({
      name: "Zebra Whisky",
      brandId: brand.id,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Alpha Whisky",
      brandId: brand.id,
    });

    const { results } = await routerClient.bottles.list({
      sort: "name",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle2.id);
    expect(results[1].id).toBe(bottle1.id);
  });

  test("sorts bottles by name descending", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Singleton" });
    const bottle1 = await fixtures.Bottle({
      name: "Alpha Whisky",
      brandId: brand.id,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Zebra Whisky",
      brandId: brand.id,
    });

    const { results } = await routerClient.bottles.list({
      sort: "-name",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle2.id);
    expect(results[1].id).toBe(bottle1.id);
  });

  test("sorts bottles by age ascending", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Old Whisky",
      statedAge: 18,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Young Whisky",
      statedAge: 12,
    });
    const bottle3 = await fixtures.Bottle({ name: "No Age" }); // null age

    const { results } = await routerClient.bottles.list({
      sort: "age",
    });

    expect(results.length).toBe(3);
    expect(results[0].id).toBe(bottle3.id); // null first
    expect(results[1].id).toBe(bottle2.id); // 12
    expect(results[2].id).toBe(bottle1.id); // 18
  });

  test("sorts bottles by age descending", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Old Whisky",
      statedAge: 18,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Young Whisky",
      statedAge: 12,
    });
    const bottle3 = await fixtures.Bottle({ name: "No Age" }); // null age

    const { results } = await routerClient.bottles.list({
      sort: "-age",
    });

    expect(results.length).toBe(3);
    expect(results[0].id).toBe(bottle1.id); // 18 first
    expect(results[1].id).toBe(bottle2.id); // 12
    expect(results[2].id).toBe(bottle3.id); // null last
  });

  test("sorts bottles by created date ascending", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "First Bottle" });
    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
    const bottle2 = await fixtures.Bottle({ name: "Second Bottle" });

    const { results } = await routerClient.bottles.list({
      sort: "created",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle1.id); // Created first
    expect(results[1].id).toBe(bottle2.id);
  });

  test("sorts bottles by created date descending", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "First Bottle" });
    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
    const bottle2 = await fixtures.Bottle({ name: "Second Bottle" });

    const { results } = await routerClient.bottles.list({
      sort: "-created",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle2.id); // Created last, shown first
    expect(results[1].id).toBe(bottle1.id);
  });

  test("sorts bottles by tastings ascending", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Popular Bottle",
      totalTastings: 10,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Less Popular",
      totalTastings: 5,
    });

    const { results } = await routerClient.bottles.list({
      sort: "tastings",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle2.id); // 5 tastings first
    expect(results[1].id).toBe(bottle1.id); // 10 tastings
  });

  test("sorts bottles by tastings descending (default)", async ({
    fixtures,
  }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Less Popular",
      totalTastings: 5,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Popular Bottle",
      totalTastings: 10,
    });

    const { results } = await routerClient.bottles.list({
      sort: "-tastings",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle2.id); // 10 tastings first
    expect(results[1].id).toBe(bottle1.id); // 5 tastings
  });

  test("sorts bottles by rating ascending", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "High Rated",
      avgRating: 2,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Low Rated",
      avgRating: 1,
    });
    const bottle3 = await fixtures.Bottle({ name: "No Rating" }); // null rating

    const { results } = await routerClient.bottles.list({
      sort: "rating",
    });

    expect(results.length).toBe(3);
    expect(results[2].id).toBe(bottle3.id); // null last
    expect(results[0].id).toBe(bottle2.id); // 3.0 first
    expect(results[1].id).toBe(bottle1.id); // 4.5
  });

  test("sorts bottles by rating descending", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      name: "High Rated",
      avgRating: 2,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Low Rated",
      avgRating: 1,
    });
    const bottle3 = await fixtures.Bottle({ name: "No Rating" }); // null rating

    const { results } = await routerClient.bottles.list({
      sort: "-rating",
    });

    expect(results.length).toBe(3);
    expect(results[0].id).toBe(bottle1.id); // 4.5 first
    expect(results[1].id).toBe(bottle2.id); // 3.0
    expect(results[2].id).toBe(bottle3.id); // null last
  });

  test("sorts bottles by rank with query", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Wood Whisky" });
    const bottle2 = await fixtures.Bottle({ name: "Wooden Cask Whisky" });

    const { results } = await routerClient.bottles.list({
      query: "wood",
      sort: "rank",
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    // Verify our bottles are in the results
    const foundBottles = results.filter(
      (b) => b.id === bottle1.id || b.id === bottle2.id,
    );
    expect(foundBottles.length).toBeGreaterThanOrEqual(1);
    // Results should be ordered by search relevance
  });

  test("sorts bottles by rank without query (falls back to tastings)", async ({
    fixtures,
  }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Less Popular",
      totalTastings: 5,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Popular Bottle",
      totalTastings: 10,
    });

    const { results } = await routerClient.bottles.list({
      sort: "rank",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle2.id); // Higher tastings first
    expect(results[1].id).toBe(bottle1.id);
  });

  test("sorts bottles by brand with entity filter", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ name: "Test Distillery" });
    const bottle1 = await fixtures.Bottle({
      name: "Zebra Expression",
      brandId: entity.id,
    });
    const bottle2 = await fixtures.Bottle({
      name: "Alpha Expression",
      brandId: entity.id,
    });

    const { results } = await routerClient.bottles.list({
      entity: entity.id,
      sort: "brand",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(bottle2.id); // Alpha comes first
    expect(results[1].id).toBe(bottle1.id);
  });

  test("rejects brand sort without entity filter", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Test Bottle" });

    const err = await waitError(
      routerClient.bottles.list({
        sort: "brand",
      }),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot sort by brand without entity filter.]`,
    );
  });

  // Pagination tests
  test("handles pagination with cursor and limit", async ({ fixtures }) => {
    // Create 5 bottles
    const bottles = [];
    for (let i = 1; i <= 5; i++) {
      bottles.push(
        await fixtures.Bottle({
          name: `Bottle ${i}`,
          totalTastings: i, // For consistent ordering
        }),
      );
    }

    // First page
    const page1 = await routerClient.bottles.list({
      limit: 2,
      cursor: 1,
      sort: "-tastings",
    });

    expect(page1.results.length).toBe(2);
    expect(page1.rel.nextCursor).toBe(2);
    expect(page1.rel.prevCursor).toBe(null);

    // Second page
    const page2 = await routerClient.bottles.list({
      limit: 2,
      cursor: 2,
      sort: "-tastings",
    });

    expect(page2.results.length).toBe(2);
    expect(page2.rel.nextCursor).toBe(3);
    expect(page2.rel.prevCursor).toBe(1);

    // Last page
    const page3 = await routerClient.bottles.list({
      limit: 2,
      cursor: 3,
      sort: "-tastings",
    });

    expect(page3.results.length).toBe(1); // Only 1 bottle left
    expect(page3.rel.nextCursor).toBe(null);
    expect(page3.rel.prevCursor).toBe(2);
  });

  test("handles empty results", async () => {
    const { results, rel } = await routerClient.bottles.list({});

    expect(results.length).toBe(0);
    expect(rel.nextCursor).toBe(null);
    expect(rel.prevCursor).toBe(null);
  });

  test("handles large limit values", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Test Bottle" });

    const { results } = await routerClient.bottles.list({
      limit: 100, // Max allowed
    });

    expect(results.length).toBe(1);
  });

  // Complex filter combinations
  test("combines multiple filters", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Test Brand" });
    const distiller = await fixtures.Entity({ name: "Test Distiller" });

    const bottle1 = await fixtures.Bottle({
      name: "Perfect Match",
      brandId: brand.id,
      distillerIds: [distiller.id],
      category: "single_malt",
      statedAge: 12,
      flavorProfile: "peated",
    });

    // Create bottles that don't match all criteria
    await fixtures.Bottle({
      name: "Wrong Brand",
      category: "single_malt",
      statedAge: 12,
      flavorProfile: "peated",
    });

    await fixtures.Bottle({
      name: "Wrong Category",
      brandId: brand.id,
      distillerIds: [distiller.id],
      category: "bourbon",
      statedAge: 12,
      flavorProfile: "peated",
    });

    const { results } = await routerClient.bottles.list({
      brand: brand.id,
      distiller: distiller.id,
      category: "single_malt",
      age: 12,
      flavorProfile: "peated",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("handles query with filters", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Highland Distillery" });
    const bottle1 = await fixtures.Bottle({
      name: "Highland Single Malt",
      brandId: brand.id,
      category: "single_malt",
    });

    await fixtures.Bottle({
      name: "Highland Blend", // Matches query but wrong category
      brandId: brand.id,
      category: "blend",
    });

    const { results } = await routerClient.bottles.list({
      query: "highland",
      category: "single_malt",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  // Edge cases
  test("handles special characters in query", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Whisky & Co." });

    const { results } = await routerClient.bottles.list({
      query: "whisky &",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("handles empty query string", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Test Bottle" });

    const { results } = await routerClient.bottles.list({
      query: "",
    });

    expect(results.length).toBe(1);
  });

  test("handles non-existent entity filters", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Test Bottle" });

    const { results } = await routerClient.bottles.list({
      brand: 999999,
    });

    expect(results.length).toBe(0);
  });

  test("validates input parameters", async () => {
    const err = await waitError(
      routerClient.bottles.list({
        limit: 101, // Above max
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("validates cursor parameter", async () => {
    const err = await waitError(
      routerClient.bottles.list({
        cursor: 0, // Below min
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});
