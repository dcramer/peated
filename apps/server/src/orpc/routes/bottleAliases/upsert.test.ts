import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottleTombstones,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, isNull } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

vi.mock("@peated/server/worker/client");

beforeEach(() => {
  vi.resetAllMocks();
});

async function genericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error("Missing generic CatalogTarget fixture");
  return target.id;
}

describe("PUT /bottle-aliases", () => {
  test("creates a direct Bottle alias with moderator provenance", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);

    await expect(
      routerClient.bottleAliases.upsert(
        { bottle: bottle.id, name: "New Direct Alias" },
        { context: { user } },
      ),
    ).resolves.toEqual({});

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "New Direct Alias"),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: null,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
  });

  test("propagates the same Bottle id and retains migration evidence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const legacy = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: legacy.id });
    const targetId = await genericTargetId(legacy.groupId!);
    const name = "Direct Propagation Alias";
    const price = await fixtures.StorePrice({
      name,
      bottleId: null,
      releaseId: release.id,
      targetId,
    });
    const review = await fixtures.Review({
      name,
      bottleId: null,
      releaseId: release.id,
      targetId,
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: bottle.id, name },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: price.releaseId,
      targetId: price.targetId,
    });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: review.releaseId,
      targetId: review.targetId,
    });
  });

  test("reindexes an existing unresolved alias when it becomes assigned", async ({
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const retained = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: retained.id });
    const targetId = await genericTargetId(retained.groupId!);
    const alias = await fixtures.BottleAlias({
      name: "Existing Unresolved Alias",
      bottleId: null,
      releaseId: release.id,
      targetId,
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: selected.id, name: alias.name },
      { context: { user } },
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({
      bottleId: selected.id,
      releaseId: release.id,
      targetId,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: selected.id },
    );
  });

  test("does not overwrite consumers already assigned to another Bottle", async ({
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const existing = await fixtures.Bottle();
    const name = "Already Assigned Consumer";
    const price = await fixtures.StorePrice({
      name,
      bottleId: existing.id,
    });
    const review = await fixtures.Review({
      name,
      bottleId: existing.id,
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: selected.id, name },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: existing.id });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({ bottleId: existing.id });
  });

  test("fills a missing Bottle image from a matching price", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    await fixtures.StorePrice({
      name: "Direct Image Alias",
      bottleId: null,
      imageUrl: "https://example.com/direct-image.jpg",
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: bottle.id, name: "Direct Image Alias" },
      { context: { user } },
    );

    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ imageUrl: "https://example.com/direct-image.jpg" });
  });

  test("rejects missing, inactive, retired, and conflicting Bottle identities", async ({
    fixtures,
  }) => {
    const existing = await fixtures.Bottle();
    const selected = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const unassigned = await fixtures.LegacyBottle();
    const retiredGroupMember = await fixtures.Bottle();
    const groupReplacement = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: existing.id,
      name: "Conflicting Direct Alias",
    });
    await db.insert(bottleTombstones).values({
      bottleId: selected.id,
      newBottleId: replacement.id,
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupMember.groupId!,
      newGroupId: groupReplacement.groupId!,
      createdByActorId: retiredGroupMember.createdByActorId,
    });
    const user = await fixtures.User({ mod: true });

    expect(
      await waitError(
        routerClient.bottleAliases.upsert(
          { bottle: 2_147_483_647, name: "Missing Bottle Alias" },
          { context: { user } },
        ),
      ),
    ).toMatchObject({ status: 404 });
    expect(
      await waitError(
        routerClient.bottleAliases.upsert(
          { bottle: unassigned.id, name: "Unassigned Bottle Alias" },
          { context: { user } },
        ),
      ),
    ).toMatchObject({
      status: 409,
      message: `Bottle ${unassigned.id} is not assigned to a BottleGroup.`,
    });
    expect(
      await waitError(
        routerClient.bottleAliases.upsert(
          {
            bottle: retiredGroupMember.id,
            name: "Retired Group Bottle Alias",
          },
          { context: { user } },
        ),
      ),
    ).toMatchObject({
      status: 409,
      message: `Bottle ${retiredGroupMember.id} belongs to a retired BottleGroup.`,
    });
    expect(
      await waitError(
        routerClient.bottleAliases.upsert(
          { bottle: selected.id, name: "Retired Bottle Alias" },
          { context: { user } },
        ),
      ),
    ).toMatchObject({ status: 409 });
    expect(
      await waitError(
        routerClient.bottleAliases.upsert(
          { bottle: replacement.id, name: "Conflicting Direct Alias" },
          { context: { user } },
        ),
      ),
    ).toMatchObject({
      status: 409,
      message:
        'Cannot reserve exact Bottle alias "Conflicting Direct Alias": another_bottle.',
    });
  });

  test("requires moderator permission", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: false });

    await expect(
      waitError(
        routerClient.bottleAliases.upsert(
          { bottle: bottle.id, name: "Unauthorized Alias" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("keeps committed assignment when indexing is unavailable", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });
    vi.mocked(workerClient.pushUniqueJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      routerClient.bottleAliases.upsert(
        { bottle: bottle.id, name: "Queue Failure Alias" },
        { context: { user } },
      ),
    ).resolves.toEqual({});
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Queue Failure Alias"),
      }),
    ).toMatchObject({ bottleId: bottle.id });
  });
});
