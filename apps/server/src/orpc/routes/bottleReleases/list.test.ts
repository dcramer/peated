import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleTombstones,
  type Bottle,
  type BottleRelease,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

async function mapPromotedRelease(release: BottleRelease, bottle: Bottle) {
  await db.insert(bottleReleasePromotions).values({
    releaseId: release.id,
    promotedBottleId: bottle.id,
    status: "promoted",
    completedAt: new Date(),
  });
}

describe("GET /bottles/:bottle/releases", () => {
  it("lists completed promotions as legacy release projections", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Legacy Family" });
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Stale release A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Stale release B",
    });
    const release3 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Stale release C",
    });
    const promoted1 = await fixtures.Bottle({
      name: "Promoted A",
      edition: "A",
      releaseYear: 2021,
    });
    const promoted2 = await fixtures.Bottle({
      name: "Promoted B",
      edition: "B",
      releaseYear: 2022,
    });
    const promoted3 = await fixtures.Bottle({
      name: "Promoted C",
      edition: "C",
      releaseYear: 2023,
    });
    await mapPromotedRelease(release1, promoted1);
    await mapPromotedRelease(release2, promoted2);
    await mapPromotedRelease(release3, promoted3);

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(release1.id);
    expect(results[0]).toMatchObject({
      bottleId: bottle.id,
      name: promoted1.name,
      fullName: promoted1.fullName,
      edition: promoted1.edition,
      releaseYear: promoted1.releaseYear,
    });
    expect(results[1].id).toBe(release2.id);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBe(null);
  });

  it("errors on invalid bottle", async () => {
    const err = await waitError(
      routerClient.bottleReleases.list({
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  it("filters by bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "A",
      name: "A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: (await fixtures.Bottle()).id,
      edition: "B",
      name: "B",
    });
    await mapPromotedRelease(
      release1,
      await fixtures.Bottle({ name: "Mapped A" }),
    );
    await mapPromotedRelease(
      release2,
      await fixtures.Bottle({ name: "Mapped B" }),
    );

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(release1.id);
    expect(rel.nextCursor).toBe(null);
    expect(rel.prevCursor).toBe(null);
  });

  it("searches the promoted Bottle index and excludes incomplete mappings", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Compatibility Parent" });
    const mappedRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Legacy wording does not match",
    });
    const pendingRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Searchable only in legacy release",
    });
    const promoted = await fixtures.Bottle({
      name: "Ordinary Search Identity 2024",
      releaseYear: 2024,
    });
    await mapPromotedRelease(mappedRelease, promoted);
    await db.insert(bottleReleasePromotions).values({
      releaseId: pendingRelease.id,
      status: "pending",
    });

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
      query: "Ordinary Search Identity 2024",
    });

    expect(results).toEqual([
      expect.objectContaining({
        id: mappedRelease.id,
        bottleId: bottle.id,
        name: promoted.name,
        fullName: promoted.fullName,
      }),
    ]);
    expect(rel.nextCursor).toBe(null);
    expect(rel.prevCursor).toBe(null);
  });

  it("does not project a completed mapping to a tombstoned Bottle", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Retired Mapping Parent" });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Retired Mapping Release",
    });
    const promoted = await fixtures.Bottle({
      name: "Retired Promoted Bottle",
    });
    const replacement = await fixtures.Bottle({
      name: "Promoted Bottle Replacement",
    });
    await mapPromotedRelease(release, promoted);
    await db.insert(bottleTombstones).values({
      bottleId: promoted.id,
      newBottleId: replacement.id,
    });

    const response = await routerClient.bottleReleases.list({
      bottle: parent.id,
    });

    expect(response.results).toEqual([]);
  });
});
