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
});
