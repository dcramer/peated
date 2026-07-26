import { db } from "@peated/server/db";
import type { Bottle, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottleReleases,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  changes,
} from "@peated/server/db/schema";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import * as testFixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, asc, eq, inArray } from "drizzle-orm";
import { vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushUniqueJob: vi.fn(),
}));

type GroupMemberExact = Omit<
  Parameters<typeof testFixtures.BottleGroupMember>[0],
  "groupId"
>;

async function createGroup(
  user: User,
  stable: Record<string, unknown>,
  exacts: GroupMemberExact[],
) {
  const first = await createConcreteBottle({
    context: { user },
    input: { stable, exact: exacts[0] },
  });
  const members: Array<{ bottle: Bottle }> = [first];
  for (const exact of exacts.slice(1)) {
    members.push({
      bottle: await testFixtures.BottleGroupMember({
        groupId: first.group.id,
        ...exact,
      }),
    });
  }
  return { first, members };
}

async function loadMembers(groupId: number) {
  return await db
    .select()
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(asc(bottles.id));
}

async function loadTargets(groupId: number) {
  return await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, groupId))
    .orderBy(asc(catalogTargets.id));
}

describe("PATCH /bottles/{bottle}", () => {
  test("requires moderator access and strictly rejects the old flat input", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Strict Update" });
    for (const user of [null, defaults.user]) {
      const error = await waitError(
        routerClient.bottles.update(
          { bottle: bottle.id },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({ status: 401 });
    }

    const mod = await fixtures.User({ mod: true });
    for (const oldInput of [
      { bottle: bottle.id, name: "Flat Name" },
      { bottle: bottle.id, groupId: bottle.groupId },
      { bottle: bottle.id, exact: { unknown: true } },
    ]) {
      const error = await waitError(
        routerClient.bottles.update(
          oldInput as Parameters<typeof routerClient.bottles.update>[0],
          { context: { user: mod } },
        ),
      );
      expect(error.message).toBe("Input validation failed");
    }

    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).toEqual(bottle);
  });

  test("returns the existing Bottle for a no-op", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "No-op Update" });
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, bottle.groupId!));

    const result = await routerClient.bottles.update(
      { bottle: bottle.id },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      id: bottle.id,
      group: { id: bottle.groupId },
    });
    expect(result).not.toHaveProperty("targetId");
    expect(result).not.toHaveProperty("kind");
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).toEqual(bottle);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, bottle.groupId!),
      }),
    ).toEqual(groupBefore);
    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.objectId, bottle.id),
          ),
        ),
    ).toHaveLength(1);
  });

  test("isolates exact edits to the selected Bottle", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Exact Route Brand" });
    const { first, members } = await createGroup(
      mod,
      { name: "Exact Route", statedAge: 12, brand: brand.id },
      [
        { edition: "Batch 1", abv: 46 },
        { edition: "Batch 2", abv: 48, description: "Sibling content" },
      ],
    );
    const groupBefore = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, first.group.id),
    });
    if (!groupBefore) throw new Error("Expected BottleGroup fixture.");
    const siblingBefore = members[1].bottle;
    const targetsBefore = await loadTargets(first.group.id);

    const result = await routerClient.bottles.update(
      {
        bottle: first.bottle.id,
        exact: {
          edition: "Batch 3",
          statedAge: 14,
          releaseYear: 2026,
          abv: 52,
          description: "Selected content",
        },
      },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      group: { id: groupBefore.id, name: groupBefore.name, statedAge: 12 },
      id: first.bottle.id,
      edition: "Batch 3",
      statedAge: 14,
      releaseYear: 2026,
      abv: 52,
      description: "Selected content",
    });
    expect((await loadMembers(groupBefore.id))[1]).toEqual(siblingBefore);
    expect(await loadTargets(groupBefore.id)).toEqual(targetsBefore);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, groupBefore.id),
      }),
    ).toEqual(groupBefore);
  });

  test("fans shared edits out durably and maps a mixed selected edit", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const oldBrand = await fixtures.Entity({ name: "Old Route Brand" });
    const newBrand = await fixtures.Entity({ name: "New Route Brand" });
    const newBottler = await fixtures.Entity({
      name: "New Route Bottler",
      type: ["bottler"],
    });
    const newDistillers = [
      await fixtures.Entity({ name: "New Route Distiller A" }),
      await fixtures.Entity({ name: "New Route Distiller B" }),
    ];
    const newSeries = await fixtures.BottleSeries({ brandId: newBrand.id });
    const { first, members } = await createGroup(
      mod,
      { name: "Old Route Label", statedAge: 12, brand: oldBrand.id },
      [
        { edition: "Batch 1", abv: 46 },
        { edition: "Batch 2", statedAge: 14, abv: 48 },
      ],
    );
    const memberIds = members.map(({ bottle }) => bottle.id);
    const targetsBefore = await loadTargets(first.group.id);
    const release = await fixtures.BottleRelease({
      bottleId: first.bottle.id,
      edition: "Legacy child",
    });

    const result = await routerClient.bottles.update(
      {
        bottle: first.bottle.id,
        shared: {
          name: "New Route Label",
          statedAge: 13,
          brand: newBrand.id,
          bottler: newBottler.id,
          distillers: newDistillers.map(({ id }) => id),
          series: newSeries.id,
          category: "single_malt",
          flavorProfile: "peated",
        },
        exact: { edition: "Batch 3", abv: 50 },
      },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      group: {
        id: first.group.id,
        name: "New Route Label",
        statedAge: 13,
        brandId: newBrand.id,
        bottlerId: newBottler.id,
        distillerIds: newDistillers.map(({ id }) => id).sort((a, b) => a - b),
        seriesId: newSeries.id,
        category: "single_malt",
        flavorProfile: "peated",
      },
      id: first.bottle.id,
      brand: { id: newBrand.id },
      bottler: { id: newBottler.id },
      series: { id: newSeries.id },
      category: "single_malt",
      flavorProfile: "peated",
      edition: "Batch 3",
      statedAge: 13,
      abv: 50,
    });

    const updatedMembers = await loadMembers(first.group.id);
    expect(updatedMembers.map(({ id }) => id)).toEqual(memberIds);
    expect(updatedMembers).toEqual([
      expect.objectContaining({
        id: first.bottle.id,
        groupId: first.group.id,
        brandId: newBrand.id,
        bottlerId: newBottler.id,
        seriesId: newSeries.id,
        statedAge: 13,
        edition: "Batch 3",
        abv: 50,
      }),
      expect.objectContaining({
        id: members[1].bottle.id,
        groupId: first.group.id,
        brandId: newBrand.id,
        bottlerId: newBottler.id,
        seriesId: newSeries.id,
        statedAge: 14,
        edition: "Batch 2",
        abv: 48,
      }),
    ]);
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(inArray(bottlesToDistillers.bottleId, memberIds)),
    ).toHaveLength(memberIds.length * newDistillers.length);
    expect(
      await db
        .select()
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, first.group.id)),
    ).toHaveLength(newDistillers.length);
    expect(await loadTargets(first.group.id)).toEqual(targetsBefore);
    expect(
      await db.query.bottleReleases.findFirst({
        where: eq(bottleReleases.id, release.id),
      }),
    ).toEqual(release);
  });

  test("maps input, graph, and identity failures to stable statuses", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const missing = await waitError(
      routerClient.bottles.update(
        { bottle: 999_999, exact: { edition: "Missing" } },
        { context: { user: mod } },
      ),
    );
    expect(missing).toMatchObject({ status: 404 });

    const legacy = await fixtures.LegacyBottle({ name: "Missing Group" });
    const missingGroup = await waitError(
      routerClient.bottles.update(
        { bottle: legacy.id, exact: { edition: "Invalid" } },
        { context: { user: mod } },
      ),
    );
    expect(missingGroup).toMatchObject({ status: 409 });

    const retired = await fixtures.Bottle({ name: "Retired Update" });
    const replacement = await fixtures.Bottle({ name: "Replacement Update" });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    const retiredError = await waitError(
      routerClient.bottles.update(
        { bottle: retired.id, exact: { edition: "Retired" } },
        { context: { user: mod } },
      ),
    );
    expect(retiredError).toMatchObject({ status: 409 });

    const invalid = await fixtures.Bottle({ name: "Invalid Target Graph" });
    await db
      .delete(bottleAliases)
      .where(eq(bottleAliases.bottleId, invalid.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.bottleId, invalid.id));
    const invalidGraph = await waitError(
      routerClient.bottles.update(
        { bottle: invalid.id, exact: { edition: "Invalid" } },
        { context: { user: mod } },
      ),
    );
    expect(invalidGraph).toMatchObject({ status: 409 });

    const roleless = await fixtures.Entity({
      name: "Not A Route Brand",
      type: [],
    });
    const valid = await fixtures.Bottle({ name: "Invalid Route Input" });
    const badInput = await waitError(
      routerClient.bottles.update(
        { bottle: valid.id, shared: { brand: roleless.id } },
        { context: { user: mod } },
      ),
    );
    expect(badInput).toMatchObject({ status: 400 });

    const brand = await fixtures.Entity({ name: "Conflict Route Brand" });
    const { members } = await createGroup(
      mod,
      { name: "Conflict Route", brand: brand.id },
      [{ edition: "One" }, { edition: "Two" }],
    );
    const conflict = await waitError(
      routerClient.bottles.update(
        {
          bottle: members[0].bottle.id,
          exact: { edition: "Two" },
        },
        { context: { user: mod } },
      ),
    );
    expect(conflict).toMatchObject({
      status: 409,
      data: { bottle: members[1].bottle.id },
    });
  });
});
