import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/release-repair-candidates", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.releaseRepairCandidates({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists legacy batch bottles under an exact parent bottle", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Glenmorangie" });
    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "The Cadboll Estate 15-year-old",
      statedAge: 15,
      totalTastings: 100,
    });
    const batch2 = await fixtures.Bottle({
      brandId: brand.id,
      name: "The Cadboll Estate 15-year-old (Batch 2)",
      statedAge: 15,
      totalTastings: 20,
    });
    const batch4 = await fixtures.Bottle({
      brandId: brand.id,
      name: "The Cadboll Estate 15-year-old (Batch 4)",
      statedAge: 15,
      totalTastings: 10,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {},
      { context: { user } },
    );

    expect(result.results).toHaveLength(2);

    const batch4Candidate = result.results.find(
      (candidate) => candidate.legacyBottle.id === batch4.id,
    );
    expect(batch4Candidate).toMatchObject({
      hasExactParent: true,
      legacyBottle: {
        id: batch4.id,
        fullName: batch4.fullName,
      },
      proposedParent: {
        id: parent.id,
        fullName: parent.fullName,
      },
      releaseIdentity: {
        edition: "Batch 4",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
      siblingLegacyBottles: [{ id: batch2.id, fullName: batch2.fullName }],
    });
  });

  test("lists sibling legacy bottles even when the parent bottle does not exist", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Festival Distillery" });
    const batch1 = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });
    const batch2 = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      totalTastings: 4,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Warehouse Session",
      },
      { context: { user } },
    );

    expect(result.results).toHaveLength(2);

    const batch1Candidate = result.results.find(
      (candidate) => candidate.legacyBottle.id === batch1.id,
    );
    expect(batch1Candidate).toMatchObject({
      hasExactParent: false,
      proposedParent: {
        id: null,
        fullName: "Festival Distillery Warehouse Session",
        totalTastings: null,
      },
      releaseIdentity: {
        edition: "Batch 1",
        releaseYear: null,
        markerSources: ["name_batch"],
      },
      siblingLegacyBottles: [{ id: batch2.id, fullName: batch2.fullName }],
    });
  });

  test("ignores formatting-only parent matches when release identity is only structured", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Formatting Distillery" });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Archive 15-year-old",
      statedAge: 15,
      totalTastings: 50,
    });
    const legacyRelease = await fixtures.Bottle({
      brandId: brand.id,
      name: "Archive 15 Year Old",
      statedAge: 15,
      releaseYear: 2024,
      totalTastings: 10,
    });
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Archive",
      },
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.legacyBottle.id === legacyRelease.id,
      ),
    ).toBeUndefined();
  });

  test("keeps pagination stable when valid candidates extend past the initial scan window", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Pagination Probe Distillery",
    });
    const user = await fixtures.User({ mod: true });

    for (let index = 0; index < 240; index += 1) {
      await fixtures.Bottle({
        brandId: brand.id,
        name: `Pagination Probe Single Barrel ${index} (Batch 1)`,
        totalTastings: 1000 - index,
      });
    }

    await fixtures.Bottle({
      brandId: brand.id,
      name: "Pagination Probe Archive Series",
      totalTastings: 50,
    });

    const validCandidateIds: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const bottle = await fixtures.Bottle({
        brandId: brand.id,
        name: `Pagination Probe Archive Series (Batch ${index + 1})`,
        totalTastings: 40 - index,
      });
      validCandidateIds.push(bottle.id);
    }

    const firstPage = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Pagination Probe",
        cursor: 1,
        limit: 15,
      },
      { context: { user } },
    );

    expect(firstPage.results).toHaveLength(15);
    expect(firstPage.rel).toMatchObject({
      nextCursor: 2,
      prevCursor: null,
    });

    const secondPage = await routerClient.bottles.releaseRepairCandidates(
      {
        query: "Pagination Probe",
        cursor: 2,
        limit: 15,
      },
      { context: { user } },
    );

    expect(secondPage.results).toHaveLength(5);
    expect(secondPage.rel).toMatchObject({
      nextCursor: null,
      prevCursor: 1,
    });

    const returnedIds = new Set([
      ...firstPage.results.map((candidate) => candidate.legacyBottle.id),
      ...secondPage.results.map((candidate) => candidate.legacyBottle.id),
    ]);

    expect(returnedIds).toEqual(new Set(validCandidateIds));
  });
});
