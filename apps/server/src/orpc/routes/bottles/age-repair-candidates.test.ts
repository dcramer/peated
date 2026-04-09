import { db } from "@peated/server/db";
import { bottleReleases, bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /bottles/age-repair-candidates", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.ageRepairCandidates({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists dirty parent age candidates that need a new parent-age release", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Glenglassaugh" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "1978 Rare Cask Release",
      statedAge: 40,
      totalTastings: 50,
    });
    const batch1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 35,
      totalTastings: 10,
    });
    const user = await fixtures.User({ mod: true });

    await db
      .update(bottles)
      .set({ numReleases: 1 })
      .where(eq(bottles.id, bottle.id));

    const result = await routerClient.bottles.ageRepairCandidates(
      {},
      { context: { user } },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      bottle: {
        id: bottle.id,
        fullName: bottle.fullName,
        name: bottle.name,
        statedAge: 40,
      },
      repairMode: "create_release",
      targetRelease: {
        id: null,
        fullName: "Glenglassaugh 1978 Rare Cask Release - 40-year-old",
        statedAge: 40,
      },
      conflictingReleases: [
        {
          id: batch1.id,
          fullName: batch1.fullName,
          statedAge: 35,
        },
      ],
    });
  });

  test("reuses an existing parent-age release when one already exists", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Glenglassaugh" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "1978 Rare Cask Release",
      statedAge: 40,
      totalTastings: 50,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 35,
      totalTastings: 10,
    });
    const existingRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      statedAge: 40,
      totalTastings: 25,
    });
    const user = await fixtures.User({ mod: true });

    await db
      .update(bottles)
      .set({ numReleases: 2 })
      .where(eq(bottles.id, bottle.id));

    const result = await routerClient.bottles.ageRepairCandidates(
      {},
      { context: { user } },
    );

    expect(result.results[0]).toMatchObject({
      bottle: {
        id: bottle.id,
      },
      repairMode: "existing_release",
      targetRelease: {
        id: existingRelease.id,
        fullName: existingRelease.fullName,
        statedAge: 40,
      },
    });
  });

  test("ignores bottles that market the parent age in the canonical name", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Springbank" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "10yo",
      statedAge: 10,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 12,
    });
    const user = await fixtures.User({ mod: true });

    await db
      .update(bottles)
      .set({ numReleases: 1 })
      .where(eq(bottles.id, bottle.id));

    const result = await routerClient.bottles.ageRepairCandidates(
      {},
      { context: { user } },
    );

    expect(
      result.results.find((candidate) => candidate.bottle.id === bottle.id),
    ).toBeUndefined();
  });

  test("continues scanning after filtered rows before applying the candidate cap", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Springbank" });
    const user = await fixtures.User({ mod: true });
    const falsePositiveBottles = await db
      .insert(bottles)
      .values(
        Array.from({ length: 2000 }, (_, index) => ({
          brandId: brand.id,
          createdById: user.id,
          fullName: `Springbank 10yo Noise ${index + 1}`,
          name: `10yo Noise ${index + 1}`,
          statedAge: 10,
          numReleases: 1,
          totalTastings: 5000 - index,
        })),
      )
      .returning({
        id: bottles.id,
        fullName: bottles.fullName,
        name: bottles.name,
      });

    await db.insert(bottleReleases).values(
      falsePositiveBottles.map((bottle) => ({
        bottleId: bottle.id,
        createdById: user.id,
        fullName: `${bottle.fullName} - Batch 1`,
        name: `${bottle.name} - Batch 1`,
        edition: "Batch 1",
        statedAge: 12,
      })),
    );

    const validBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "1978 Rare Cask Release",
      statedAge: 40,
      totalTastings: 1,
    });
    await fixtures.BottleRelease({
      bottleId: validBottle.id,
      edition: "Batch 1",
      statedAge: 35,
      totalTastings: 1,
    });

    await db
      .update(bottles)
      .set({ numReleases: 1 })
      .where(eq(bottles.id, validBottle.id));

    const result = await routerClient.bottles.ageRepairCandidates(
      {},
      { context: { user } },
    );

    expect(
      result.results.find(
        (candidate) => candidate.bottle.id === validBottle.id,
      ),
    ).toMatchObject({
      bottle: {
        id: validBottle.id,
      },
      repairMode: "create_release",
    });
  });
});
