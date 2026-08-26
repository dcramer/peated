import { db } from "@peated/server/db";
import type { Bottle, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottleSeries,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { materializeBottleForGroup } from "@peated/server/lib/bottleIdentity";
import {
  createBottle,
  type BottleCreateInput,
} from "@peated/server/lib/createBottle";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import * as testFixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import {
  BottlePatchSchema,
  BottleUpdateAuthorizationError,
  BottleUpdateConflictError,
  BottleUpdateExpectedStateError,
  BottleUpdateGraphError,
  BottleUpdateInputError,
  bottleUpdateExpectedSharedState,
  finalizeBottleUpdate,
  updateBottle,
  updateBottleInTransaction,
} from "@peated/server/lib/updateBottle";
import type { Context } from "@peated/server/orpc/context";
import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZodError } from "zod";

function contextFor<TUser extends User | null>(
  user: TUser,
): Context & { user: TUser } {
  return { user };
}

type GroupMemberExact = Omit<
  Parameters<typeof testFixtures.BottleGroupMember>[0],
  "groupId"
>;

async function createGroup({
  user,
  stable,
  exacts,
}: {
  user: User;
  stable: Partial<BottleCreateInput>;
  exacts: GroupMemberExact[];
}) {
  if (!exacts.length) throw new Error("At least one exact Bottle is required.");

  const first = await createBottle({
    context: contextFor(user),
    input: { ...stable, ...exacts[0] },
  });
  if ("statedAge" in stable) {
    const statedAge = stable.statedAge ?? null;
    const materialized = materializeBottleForGroup({
      group: { ...first.group, statedAge },
      exact: {
        edition: first.bottle.edition,
        statedAge: exacts[0].statedAge ?? null,
        releaseYear: first.bottle.releaseYear,
        vintageYear: first.bottle.vintageYear,
        abv: first.bottle.abv,
        singleCask: first.bottle.singleCask,
        caskStrength: first.bottle.caskStrength,
        caskType: first.bottle.caskType,
        caskSize: first.bottle.caskSize,
        caskFill: first.bottle.caskFill,
      },
    });
    await db
      .update(bottleGroups)
      .set({ statedAge })
      .where(eq(bottleGroups.id, first.group.id));
    await db
      .update(bottles)
      .set(materialized)
      .where(eq(bottles.id, first.bottle.id));
    Object.assign(first.group, { statedAge });
    Object.assign(first.bottle, materialized);
  }
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

async function loadGroupMembers(groupId: number) {
  return await db
    .select()
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(asc(bottles.id));
}

async function loadAliases(bottleIds: number[]) {
  return await db
    .select()
    .from(bottleAliases)
    .where(inArray(bottleAliases.bottleId, bottleIds))
    .orderBy(asc(bottleAliases.name));
}

async function loadUpdateAudits(bottleIds: number[]) {
  return await db
    .select()
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "bottle"),
        eq(changes.type, "update"),
        inArray(changes.objectId, bottleIds),
      ),
    )
    .orderBy(asc(changes.objectId), asc(changes.id));
}

async function loadBottleDistillers(bottleIds: number[]) {
  return await db
    .select()
    .from(bottlesToDistillers)
    .where(inArray(bottlesToDistillers.bottleId, bottleIds))
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    );
}

function selectBottleAggregates(
  rows: Awaited<ReturnType<typeof loadGroupMembers>>,
) {
  return rows.map(({ id, totalTastings, avgRating, ratingStats }) => ({
    id,
    totalTastings,
    avgRating,
    ratingStats,
  }));
}

function resetQueueMock() {
  vi.mocked(workerClient.pushUniqueJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockResolvedValue(undefined);
}

describe("Bottle updates", () => {
  beforeEach(() => {
    resetQueueMock();
  });

  test("authorizes before parsing or loading and rejects unknown or invalid input", async ({
    defaults,
    fixtures,
  }) => {
    const invalidRawInput = {
      groupId: 123,
      brand: 0,
      unknown: true,
    };
    for (const user of [null, defaults.user]) {
      const error = await waitError(
        updateBottle({
          bottleId: 999_999,
          input: invalidRawInput,
          context: contextFor(user),
        }),
        BottleUpdateAuthorizationError,
      );
      expect(error).toBeInstanceOf(BottleUpdateAuthorizationError);
    }

    const bottle = await fixtures.Bottle();
    const mod = await fixtures.User({ mod: true });
    const admin = await fixtures.User({ admin: true });
    await expect(
      updateBottle({
        bottleId: bottle.id,
        input: {},
        context: contextFor(mod),
      }),
    ).resolves.toMatchObject({ changed: false });
    await expect(
      updateBottle({
        bottleId: bottle.id,
        input: {},
        context: contextFor(admin),
      }),
    ).resolves.toMatchObject({ changed: false });

    for (const input of [
      { groupId: bottle.groupId },
      { unexpected: true },
      { brand: 0 },
      { distillers: [{ id: -1, name: "Invalid" }] },
    ]) {
      expect(
        await waitError(
          updateBottle({
            bottleId: bottle.id,
            input,
            context: contextFor(mod),
          }),
        ),
      ).toBeInstanceOf(ZodError);
    }
    expect(
      await waitError(
        updateBottle({
          bottleId: 0,
          input: {},
          context: contextFor(mod),
        }),
        BottleUpdateInputError,
      ),
    ).toBeInstanceOf(BottleUpdateInputError);
    expect(await loadUpdateAudits([bottle.id])).toEqual([]);
  });

  test("returns an inert result for empty and semantic no-op patches", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "No-op Brand" });
    const { first } = await createGroup({
      user: mod,
      stable: {
        name: "No-op Expression",
        statedAge: 12,
        brand: brand.id,
        distillers: [],
        category: "single_malt",
        flavorProfile: "peated",
      },
      exacts: [{ edition: "Batch 1", abv: 46 }],
    });
    resetQueueMock();
    const bottleBefore = first.bottle;
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const aliasesBefore = await loadAliases([first.bottle.id]);

    const empty = await updateBottle({
      bottleId: first.bottle.id,
      input: {},
      context: contextFor(mod),
    });
    const semantic = await updateBottle({
      bottleId: first.bottle.id,
      input: {
        name: groupBefore.name,
        statedAge: groupBefore.statedAge,
        brand: groupBefore.brandId,
        distillers: [],
        category: groupBefore.category,
        flavorProfile: groupBefore.flavorProfile,
        edition: bottleBefore.edition,
        abv: bottleBefore.abv,
      },
      context: contextFor(mod),
    });

    expect(empty.changed).toBe(false);
    expect(semantic.changed).toBe(false);
    const [bottleAfter] = await loadGroupMembers(first.group.id);
    const [groupAfter] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    expect(bottleAfter.updatedAt).toEqual(bottleBefore.updatedAt);
    expect(groupAfter.updatedAt).toEqual(groupBefore.updatedAt);
    expect(await loadUpdateAudits([first.bottle.id])).toEqual([]);
    expect(await loadAliases([first.bottle.id])).toEqual(aliasesBefore);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("composes a sourced update transaction with explicit post-commit finalization", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const brand = await fixtures.Entity({ name: "Composed Source Brand" });
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Composed Source", brand: brand.id },
      exacts: [{ edition: "One" }],
    });
    resetQueueMock();

    const manifest = await db.transaction(async (tx) => {
      const result = await updateBottleInTransaction(tx, {
        bottleId: first.bottle.id,
        input: BottlePatchSchema.parse({
          brand: { name: "Composed Review Brand" },
          distillers: [{ name: "Composed Review Distillery" }],
        }),
        actorId: actor.id,
        creationSource: "price_match_review",
      });
      expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
      return result;
    });

    expect(manifest).toMatchObject({
      changed: true,
      creationSource: "price_match_review",
      changedBottleIds: [first.bottle.id],
    });
    expect((await loadUpdateAudits([first.bottle.id]))[0]?.data).toMatchObject({
      creationSource: "price_match_review",
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();

    await finalizeBottleUpdate(manifest);

    const createdEntities = await db
      .select({ id: entities.id })
      .from(entities)
      .where(
        inArray(entities.name, [
          "Composed Review Brand",
          "Composed Review Distillery",
        ]),
      );
    expect(createdEntities).toHaveLength(2);
    for (const { id: entityId } of createdEntities) {
      expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
        "VerifyEntityCreation",
        { entityId, creationSource: "price_match_review" },
        { delay: 5_000 },
      );
    }
  });

  test("rejects a maintenance edit planned from stale shared authority", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const sourceBrand = await fixtures.Entity({ name: "Snapshot Source" });
    const targetBrand = await fixtures.Entity({ name: "Snapshot Target" });
    const distiller = await fixtures.Entity({
      name: "Snapshot Distillery",
      type: ["distiller"],
    });
    const { first } = await createGroup({
      user: mod,
      stable: {
        name: "Original Authority",
        brand: sourceBrand.id,
        distillers: [distiller.id],
      },
      exacts: [{ edition: "Batch 1" }],
    });
    const groupBefore = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, first.group.id),
    });
    if (!groupBefore) throw new Error("Expected BottleGroup fixture.");
    const distillersBefore = await db
      .select({ distillerId: bottleGroupDistillers.distillerId })
      .from(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, first.group.id));
    const expectedSharedState = bottleUpdateExpectedSharedState({
      group: groupBefore,
      distillerIds: distillersBefore.map(({ distillerId }) => distillerId),
      series: null,
    });

    await updateBottle({
      bottleId: first.bottle.id,
      input: { name: "New Authority" },
      context: contextFor(mod),
    });

    const error = await waitError(
      db.transaction((tx) =>
        updateBottleInTransaction(tx, {
          bottleId: first.bottle.id,
          input: { brand: targetBrand.id },
          expectedSharedState,
          actorId: actor.id,
          creationSource: "repair_workflow",
        }),
      ),
      BottleUpdateExpectedStateError,
    );
    expect(error).toMatchObject({ groupId: first.group.id });
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, first.group.id),
      }),
    ).toMatchObject({ brandId: sourceBrand.id, name: "New Authority" });
  });

  test("rejects a cached destination series that changed before the group lock", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const brand = await fixtures.Entity({ name: "Series Snapshot Brand" });
    const targetSeries = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Target Range",
    });
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Series Snapshot", brand: brand.id },
      exacts: [{ edition: "Batch 1" }],
    });
    const groupBefore = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, first.group.id),
    });
    if (!groupBefore) throw new Error("Expected BottleGroup fixture.");
    const expectedSharedState = bottleUpdateExpectedSharedState({
      group: groupBefore,
      distillerIds: [],
      referencedSeries: [targetSeries],
      series: null,
    });
    await db
      .update(bottleSeries)
      .set({
        name: "Renamed Range",
        fullName: "Series Snapshot Brand Renamed Range",
      })
      .where(eq(bottleSeries.id, targetSeries.id));

    const error = await waitError(
      db.transaction((tx) =>
        updateBottleInTransaction(tx, {
          bottleId: first.bottle.id,
          input: { series: targetSeries.id },
          expectedSharedState,
          actorId: actor.id,
          creationSource: "repair_workflow",
        }),
      ),
      BottleUpdateExpectedStateError,
    );

    expect(error).toMatchObject({ groupId: first.group.id });
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, first.group.id),
      }),
    ).toMatchObject({ seriesId: null });
  });

  test("adds requested roles to existing numeric entities", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({
      name: "Role Validation Brand",
      type: ["brand"],
    });
    const rolelessBrand = await fixtures.Entity({
      name: "Roleless Brand",
      type: [],
    });
    const rolelessBottler = await fixtures.Entity({
      name: "Roleless Bottler",
      type: [],
    });
    const rolelessDistiller = await fixtures.Entity({
      name: "Roleless Distiller",
      type: [],
    });
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Role Validation Label", brand: brand.id },
      exacts: [{ edition: "One" }],
    });
    resetQueueMock();

    const result = await updateBottle({
      bottleId: first.bottle.id,
      input: {
        brand: rolelessBrand.id,
        bottler: rolelessBottler.id,
        distillers: [rolelessDistiller.id],
      },
      context: contextFor(mod),
    });

    expect(result.changed).toBe(true);
    expect(result.group).toMatchObject({
      brandId: rolelessBrand.id,
      bottlerId: rolelessBottler.id,
    });
    for (const [entityId, role] of [
      [rolelessBrand.id, "brand"],
      [rolelessBottler.id, "bottler"],
      [rolelessDistiller.id, "distiller"],
    ] as const) {
      expect(
        await db.query.entities.findFirst({
          where: eq(entities.id, entityId),
        }),
      ).toMatchObject({ type: [role] });
      expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
        "OnEntityChange",
        { entityId },
      );
    }
    expect(await loadBottleDistillers([first.bottle.id])).toMatchObject([
      { bottleId: first.bottle.id, distillerId: rolelessDistiller.id },
    ]);
    expect(await loadUpdateAudits([first.bottle.id])).toHaveLength(1);
  });

  test("accounts for a role added while resolving an existing entity", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({
      name: "Existing Role Lifecycle Brand",
      type: ["brand"],
    });
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Role Lifecycle Label", brand: brand.id },
      exacts: [{ edition: "One" }],
    });
    await db
      .update(entities)
      .set({ type: [] })
      .where(eq(entities.id, brand.id));
    resetQueueMock();
    let observedCommittedRole = false;
    vi.mocked(workerClient.pushUniqueJob).mockImplementation(
      async (jobName, payload) => {
        if (
          jobName === "OnEntityChange" &&
          payload !== undefined &&
          "entityId" in payload &&
          payload.entityId === brand.id
        ) {
          const persisted = await db.query.entities.findFirst({
            where: eq(entities.id, brand.id),
          });
          observedCommittedRole = persisted?.type.includes("brand") ?? false;
        }
      },
    );

    const result = await updateBottle({
      bottleId: first.bottle.id,
      input: { brand: { name: brand.name } },
      context: contextFor(mod),
    });

    expect(result.changed).toBe(true);
    expect(observedCommittedRole).toBe(true);
    expect(
      await db.query.entities.findFirst({ where: eq(entities.id, brand.id) }),
    ).toMatchObject({ type: ["brand"] });
    const audits = await loadUpdateAudits([first.bottle.id]);
    expect(audits).toHaveLength(1);
    expect(audits[0].data).toMatchObject({ updateScope: "shared" });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnEntityChange", {
      entityId: brand.id,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "VerifyEntityCreation",
      expect.objectContaining({ entityId: brand.id }),
    );
  });

  test("dispatches old and new shared owners exactly once after commit", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const oldBrand = await fixtures.Entity({
      name: "Aggregate Old Brand",
      type: ["brand"],
    });
    const oldBottler = await fixtures.Entity({
      name: "Aggregate Old Bottler",
      type: ["bottler"],
    });
    const oldDistiller = await fixtures.Entity({
      name: "Aggregate Old Distiller",
      type: ["distiller"],
    });
    const newBrand = await fixtures.Entity({
      name: "Aggregate New Brand",
      type: ["brand"],
    });
    const newBottler = await fixtures.Entity({
      name: "Aggregate New Bottler",
      type: ["bottler"],
    });
    const newDistiller = await fixtures.Entity({
      name: "Aggregate New Distiller",
      type: ["distiller"],
    });
    const { first } = await createGroup({
      user: mod,
      stable: {
        name: "Aggregate Owners",
        brand: oldBrand.id,
        bottler: oldBottler.id,
        distillers: [oldDistiller.id],
      },
      exacts: [{ edition: "One" }],
    });
    resetQueueMock();

    let observedCommittedOwners = false;
    vi.mocked(workerClient.pushUniqueJob).mockImplementation(
      async (jobName) => {
        if (jobName !== "OnEntityChange" || observedCommittedOwners) return;

        const persistedGroup = await db.query.bottleGroups.findFirst({
          where: eq(bottleGroups.id, first.group.id),
          with: {
            distillers: {
              columns: { distillerId: true },
            },
          },
        });
        observedCommittedOwners =
          persistedGroup?.brandId === newBrand.id &&
          persistedGroup.bottlerId === newBottler.id &&
          persistedGroup.distillers.length === 1 &&
          persistedGroup.distillers[0]?.distillerId === newDistiller.id;
      },
    );

    await updateBottle({
      bottleId: first.bottle.id,
      input: {
        brand: newBrand.id,
        bottler: newBottler.id,
        distillers: [newDistiller.id],
      },
      context: contextFor(mod),
    });

    const ownerEntityIds = vi
      .mocked(workerClient.pushUniqueJob)
      .mock.calls.flatMap(([jobName, payload]) =>
        jobName === "OnEntityChange" &&
        payload !== undefined &&
        "entityId" in payload
          ? [payload.entityId]
          : [],
      );
    const expectedOwnerEntityIds = [
      oldBrand.id,
      oldBottler.id,
      oldDistiller.id,
      newBrand.id,
      newBottler.id,
      newDistiller.id,
    ].sort((left, right) => left - right);
    expect(observedCommittedOwners).toBe(true);
    expect(ownerEntityIds).toEqual(expectedOwnerEntityIds);
    expect(new Set(ownerEntityIds).size).toBe(ownerEntityIds.length);

    resetQueueMock();
    await expect(
      updateBottle({
        bottleId: first.bottle.id,
        input: {
          brand: newBrand.id,
          bottler: newBottler.id,
          distillers: [newDistiller.id],
        },
        context: contextFor(mod),
      }),
    ).resolves.toMatchObject({ changed: false });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("migrates an exclusively used retained series when the brand changes", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const oldBrand = await fixtures.Entity({ name: "Old Series Brand" });
    const newBrand = await fixtures.Entity({ name: "New Series Brand" });
    const oldSeries = await fixtures.BottleSeries({
      brandId: oldBrand.id,
      name: "Shared Range",
      fullName: `${oldBrand.name} Shared Range`,
      description: "A range that survives a brand correction.",
    });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Series Label",
        brand: oldBrand.id,
        series: oldSeries.id,
      },
      exacts: [{ edition: "One" }, { edition: "Two" }],
    });

    const result = await updateBottle({
      bottleId: first.bottle.id,
      input: { brand: newBrand.id },
      context: contextFor(mod),
    });

    const migratedSeries = await db.query.bottleSeries.findFirst({
      where: eq(bottleSeries.id, oldSeries.id),
    });
    expect(migratedSeries).toMatchObject({
      id: oldSeries.id,
      name: oldSeries.name,
      fullName: `${newBrand.name} ${oldSeries.name}`,
      description: oldSeries.description,
      brandId: newBrand.id,
      numReleases: members.length,
    });
    expect(result.group).toMatchObject({
      brandId: newBrand.id,
      seriesId: oldSeries.id,
    });
    expect(await loadGroupMembers(first.group.id)).toEqual(
      expect.arrayContaining(
        members.map(({ bottle }) =>
          expect.objectContaining({
            id: bottle.id,
            brandId: newBrand.id,
            seriesId: oldSeries.id,
          }),
        ),
      ),
    );
    expect(
      await db
        .select()
        .from(bottleSeries)
        .where(eq(bottleSeries.name, oldSeries.name)),
    ).toHaveLength(1);
  });

  test("duplicates a retained series still used by another BottleGroup", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const oldBrand = await fixtures.Entity({ name: "Shared Series Brand" });
    const newBrand = await fixtures.Entity({ name: "Split Series Brand" });
    const oldSeries = await fixtures.BottleSeries({
      brandId: oldBrand.id,
      name: "Shared Range",
      fullName: `${oldBrand.name} Shared Range`,
      description: "A range shared by multiple Bottle Groups.",
    });
    const moving = await createGroup({
      user: mod,
      stable: {
        name: "Moving Label",
        brand: oldBrand.id,
        series: oldSeries.id,
      },
      exacts: [{ edition: "One" }],
    });
    const staying = await createGroup({
      user: mod,
      stable: {
        name: "Staying Label",
        brand: oldBrand.id,
        series: oldSeries.id,
      },
      exacts: [{ edition: "One" }],
    });

    const result = await updateBottle({
      bottleId: moving.first.bottle.id,
      input: { brand: newBrand.id },
      context: contextFor(mod),
    });

    const destinationSeries = await db.query.bottleSeries.findFirst({
      where: and(
        eq(bottleSeries.brandId, newBrand.id),
        eq(bottleSeries.name, oldSeries.name),
      ),
    });
    expect(destinationSeries).toMatchObject({
      description: oldSeries.description,
      numReleases: 1,
    });
    expect(destinationSeries?.id).not.toBe(oldSeries.id);
    expect(result.group.seriesId).toBe(destinationSeries?.id);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, staying.first.group.id),
      }),
    ).toMatchObject({ brandId: oldBrand.id, seriesId: oldSeries.id });
    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, oldSeries.id),
      }),
    ).toMatchObject({ brandId: oldBrand.id, numReleases: 1 });
  });

  test("reuses a matching destination series when the brand changes", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const oldBrand = await fixtures.Entity({ name: "Source Series Brand" });
    const newBrand = await fixtures.Entity({
      name: "Destination Series Brand",
    });
    const oldSeries = await fixtures.BottleSeries({
      brandId: oldBrand.id,
      name: "Shared Range",
      fullName: `${oldBrand.name} Shared Range`,
    });
    const destinationSeries = await fixtures.BottleSeries({
      brandId: newBrand.id,
      name: oldSeries.name,
      fullName: `${newBrand.name} ${oldSeries.name}`,
    });
    const { first } = await createGroup({
      user: mod,
      stable: {
        name: "Series Label",
        brand: oldBrand.id,
        series: oldSeries.id,
      },
      exacts: [{ edition: "One" }],
    });

    const result = await updateBottle({
      bottleId: first.bottle.id,
      input: { brand: newBrand.id },
      context: contextFor(mod),
    });

    expect(result.group).toMatchObject({
      brandId: newBrand.id,
      seriesId: destinationSeries.id,
    });
    expect(
      await db
        .select()
        .from(bottleSeries)
        .where(eq(bottleSeries.brandId, newBrand.id)),
    ).toHaveLength(1);
  });

  test("rejects an explicit series owned by another brand", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const oldBrand = await fixtures.Entity({ name: "Series Owner A" });
    const newBrand = await fixtures.Entity({ name: "Series Owner B" });
    const otherBrand = await fixtures.Entity({ name: "Series Owner C" });
    const oldSeries = await fixtures.BottleSeries({ brandId: oldBrand.id });
    const otherSeries = await fixtures.BottleSeries({ brandId: otherBrand.id });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Series Boundary Label",
        brand: oldBrand.id,
        series: oldSeries.id,
      },
      exacts: [{ edition: "One" }, { edition: "Two" }],
    });
    const memberIds = members.map(({ bottle }) => bottle.id);
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const membersBefore = await loadGroupMembers(first.group.id);
    const aliasesBefore = await loadAliases(memberIds);
    resetQueueMock();

    const error = await waitError(
      updateBottle({
        bottleId: first.bottle.id,
        input: { brand: newBrand.id, series: otherSeries.id },
        context: contextFor(mod),
      }),
      BottleUpdateInputError,
    );
    expect(error.message).toMatch(/series/i);

    expect(
      (
        await db
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, first.group.id))
      )[0],
    ).toEqual(groupBefore);
    expect(await loadGroupMembers(first.group.id)).toEqual(membersBefore);
    expect(await loadAliases(memberIds)).toEqual(aliasesBefore);
    expect(await loadUpdateAudits(memberIds)).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("isolates exact identity and content patches to the selected Bottle", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Exact Update Brand" });
    const bottler = await fixtures.Entity({
      name: "Exact Update Bottler",
      type: ["bottler"],
    });
    const distillers = [
      await fixtures.Entity({ name: "Exact Update Distiller A" }),
      await fixtures.Entity({ name: "Exact Update Distiller B" }),
    ];
    const series = await fixtures.BottleSeries({ brandId: brand.id });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Core",
        statedAge: 12,
        brand: brand.id,
        bottler: bottler.id,
        distillers: distillers.map(({ id }) => id),
        series: series.id,
        category: "single_malt",
        flavorProfile: "peated",
      },
      exacts: [
        { edition: "Batch 1", abv: 46 },
        { edition: "Batch 2", abv: 48, description: "Sibling content" },
      ],
    });
    resetQueueMock();
    const selectedBefore = members[0].bottle;
    const siblingBefore = members[1].bottle;
    const selectedSharedBefore = {
      brandId: selectedBefore.brandId,
      bottlerId: selectedBefore.bottlerId,
      seriesId: selectedBefore.seriesId,
      category: selectedBefore.category,
      flavorProfile: selectedBefore.flavorProfile,
    };
    const distillersBefore = await loadBottleDistillers([selectedBefore.id]);
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));

    const identityResult = await updateBottle({
      bottleId: selectedBefore.id,
      input: {
        edition: "Batch 3",
        statedAge: 14,
        bottlingYear: 2024,
        releaseYear: 2025,
        abv: 50,
        caskStrength: true,
      },
      context: contextFor(mod),
    });
    expect(identityResult).toMatchObject({
      changed: true,
      bottle: {
        id: selectedBefore.id,
        groupId: groupBefore.id,
        name: "Core - Batch 3 - 14-year-old - 2025 Release - 50.0% ABV - Cask Strength",
        fullName:
          "Exact Update Brand Core - Batch 3 - 14-year-old - 2025 Release - 50.0% ABV - Cask Strength",
        edition: "Batch 3",
        statedAge: 14,
        bottlingYear: 2024,
        releaseYear: 2025,
        abv: 50,
        caskStrength: true,
      },
    });
    expect(
      (await loadGroupMembers(groupBefore.id)).find(
        ({ id }) => id === selectedBefore.id,
      ),
    ).toMatchObject({
      name: identityResult.bottle.name,
      fullName: identityResult.bottle.fullName,
      statedAge: identityResult.bottle.statedAge,
      edition: identityResult.bottle.edition,
      bottlingYear: identityResult.bottle.bottlingYear,
      releaseYear: identityResult.bottle.releaseYear,
      abv: identityResult.bottle.abv,
      caskStrength: identityResult.bottle.caskStrength,
      ...selectedSharedBefore,
    });
    expect(await loadBottleDistillers([selectedBefore.id])).toEqual(
      distillersBefore,
    );

    const aliases = await loadAliases([selectedBefore.id]);
    expect(
      aliases.filter(({ name }) =>
        [selectedBefore.fullName, identityResult.bottle.fullName].includes(
          name,
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: selectedBefore.fullName,
          bottleId: selectedBefore.id,
        }),
        expect.objectContaining({
          name: identityResult.bottle.fullName,
          bottleId: selectedBefore.id,
        }),
      ]),
    );
    expect((await loadGroupMembers(groupBefore.id))[1]).toEqual(siblingBefore);
    expect(identityResult.group).toEqual(groupBefore);

    const identityBeforeContent = identityResult.bottle;
    const contentResult = await updateBottle({
      bottleId: selectedBefore.id,
      input: { description: "Updated exact content" },
      context: contextFor(mod),
    });
    expect(contentResult).toMatchObject({
      changed: true,
      bottle: {
        description: "Updated exact content",
        descriptionSrc: "user",
        name: identityBeforeContent.name,
        fullName: identityBeforeContent.fullName,
        statedAge: identityBeforeContent.statedAge,
        ...selectedSharedBefore,
      },
    });
    expect(await loadBottleDistillers([selectedBefore.id])).toEqual(
      distillersBefore,
    );
    expect((await loadGroupMembers(groupBefore.id))[1]).toEqual(siblingBefore);
  });

  test("clears generated content for Bottle changes but not cask details", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Generated Content Brand" });
    const originalNotes = {
      nose: "Original nose",
      palate: "Original palate",
      finish: "Original finish",
    };
    const updatedNotes = {
      nose: "Moderator nose",
      palate: "Moderator palate",
      finish: "Moderator finish",
    };
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Generated Content", brand: brand.id },
      exacts: [
        {
          abv: 46,
          description: "Generated description",
          descriptionSrc: "generated",
          tastingNotes: originalNotes,
        },
      ],
    });
    await db
      .update(bottles)
      .set({ suggestedTags: ["smoke", "fruit"] })
      .where(eq(bottles.id, first.bottle.id));

    const contentResult = await updateBottle({
      bottleId: first.bottle.id,
      input: { tastingNotes: updatedNotes },
      context: contextFor(mod),
    });
    expect(contentResult.bottle).toMatchObject({
      description: "Generated description",
      descriptionSrc: "generated",
      suggestedTags: ["smoke", "fruit"],
      tastingNotes: updatedNotes,
    });

    const caskResult = await updateBottle({
      bottleId: first.bottle.id,
      input: {
        caskType: "bourbon",
        caskSize: "barrel",
        caskFill: "1st_fill",
      },
      context: contextFor(mod),
    });
    expect(caskResult.bottle).toMatchObject({
      caskType: "bourbon",
      caskSize: "barrel",
      caskFill: "1st_fill",
      description: "Generated description",
      descriptionSrc: "generated",
      suggestedTags: ["smoke", "fruit"],
      tastingNotes: updatedNotes,
    });

    const identityResult = await updateBottle({
      bottleId: first.bottle.id,
      input: { abv: 48 },
      context: contextFor(mod),
    });
    expect(identityResult.bottle).toMatchObject({
      abv: 48,
      description: null,
      descriptionSrc: null,
      suggestedTags: [],
      tastingNotes: updatedNotes,
    });

    await db
      .update(bottles)
      .set({
        description: "Moderator description",
        descriptionSrc: "user",
        suggestedTags: ["oak"],
      })
      .where(eq(bottles.id, first.bottle.id));
    const moderatorContentResult = await updateBottle({
      bottleId: first.bottle.id,
      input: { abv: 50 },
      context: contextFor(mod),
    });
    expect(moderatorContentResult.bottle).toMatchObject({
      abv: 50,
      description: "Moderator description",
      descriptionSrc: "user",
      suggestedTags: [],
      tastingNotes: updatedNotes,
    });
  });

  test("updates direct Bottle identity and owns aliases directly", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Direct Identity Brand" });
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Direct Identity", brand: brand.id },
      exacts: [{ edition: "Original" }],
    });
    const oldLiteralName =
      "Direct Identity Brand Direct Identity   12 years old";
    const oldNormalizedName = normalizeBottleAliasKey(oldLiteralName);
    await db
      .update(bottles)
      .set({ fullName: oldLiteralName })
      .where(eq(bottles.id, first.bottle.id));
    resetQueueMock();

    const result = await updateBottle({
      bottleId: first.bottle.id,
      input: { edition: "Updated" },
      context: contextFor(mod),
    });

    expect(result).toMatchObject({
      changed: true,
      bottle: {
        id: first.bottle.id,
        groupId: first.group.id,
        edition: "Updated",
      },
    });
    const expectedAliasNames = Array.from(
      new Set([
        oldLiteralName,
        oldNormalizedName,
        result.bottle.fullName,
        normalizeBottleAliasKey(result.bottle.fullName),
      ]),
    ).sort();
    const directAliases = await db
      .select({
        name: bottleAliases.name,
        bottleId: bottleAliases.bottleId,
      })
      .from(bottleAliases)
      .where(inArray(bottleAliases.name, expectedAliasNames));
    expect(directAliases).toHaveLength(expectedAliasNames.length);
    expect(directAliases).toEqual(
      expect.arrayContaining(
        expectedAliasNames.map((name) => ({
          name,
          bottleId: first.bottle.id,
        })),
      ),
    );
    expect(await loadUpdateAudits([first.bottle.id])).toEqual([
      expect.objectContaining({
        objectId: first.bottle.id,
        data: expect.objectContaining({
          updateScope: "exact",
          edition: "Updated",
        }),
      }),
    ]);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: first.bottle.id,
    });
    for (const name of expectedAliasNames) {
      expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
        "OnBottleAliasChange",
        { name },
      );
    }
  });

  test("fans out every shared field and repairs member drift on an equal patch", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const oldBrand = await fixtures.Entity({ name: "Old Shared Brand" });
    const oldBottler = await fixtures.Entity({
      name: "Old Shared Bottler",
      type: ["bottler"],
    });
    const oldDistiller = await fixtures.Entity({ name: "Old Distiller" });
    const oldSeries = await fixtures.BottleSeries({ brandId: oldBrand.id });
    const newBrand = await fixtures.Entity({ name: "New Shared Brand" });
    const newBottler = await fixtures.Entity({
      name: "New Shared Bottler",
      type: ["bottler"],
    });
    const newDistillers = [
      await fixtures.Entity({ name: "New Distiller A" }),
      await fixtures.Entity({ name: "New Distiller B" }),
    ];
    const newSeries = await fixtures.BottleSeries({ brandId: newBrand.id });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Old Label",
        statedAge: 12,
        brand: oldBrand.id,
        bottler: oldBottler.id,
        distillers: [oldDistiller.id],
        series: oldSeries.id,
        category: "single_malt",
        flavorProfile: "peated",
      },
      exacts: [
        { edition: "Batch 1", description: "Selected content" },
        {
          edition: "Batch 2",
          abv: 51,
          caskStrength: true,
          description: "Sibling content",
        },
      ],
    });
    const memberIds = members.map(({ bottle }) => bottle.id);
    const oldNames = new Map(
      members.map(({ bottle }) => [bottle.id, bottle.fullName]),
    );
    const representativeBefore = first.group.representativeBottleId;
    const [persistedGroupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const aggregateBefore = {
      totalBottles: persistedGroupBefore.totalBottles,
      totalTastings: persistedGroupBefore.totalTastings,
      avgRating: persistedGroupBefore.avgRating,
      ratingStats: persistedGroupBefore.ratingStats,
    };
    const siblingExactBefore = members[1].bottle;

    const seededBottleAggregates = [
      {
        bottleId: members[0].bottle.id,
        totalTastings: 3,
        avgRating: 2,
        ratingStats: {
          pass: 0,
          sip: 3,
          savor: 0,
          total: 3,
          avg: 2,
          percentage: { pass: 0, sip: 100, savor: 0 },
        },
      },
      {
        bottleId: members[1].bottle.id,
        totalTastings: 5,
        avgRating: 1.4,
        ratingStats: {
          pass: 3,
          sip: 2,
          savor: 0,
          total: 5,
          avg: 1.4,
          percentage: { pass: 60, sip: 40, savor: 0 },
        },
      },
    ];
    for (const { bottleId, ...aggregates } of seededBottleAggregates) {
      await db.update(bottles).set(aggregates).where(eq(bottles.id, bottleId));
    }
    const bottleAggregatesBefore = selectBottleAggregates(
      await loadGroupMembers(first.group.id),
    );

    await db
      .update(bottles)
      .set({
        name: "Drifted Member",
        fullName: "Drifted Member Full Name",
        brandId: oldBrand.id,
        bottlerId: null,
        seriesId: null,
        category: "rye",
        flavorProfile: null,
      })
      .where(eq(bottles.id, members[1].bottle.id));
    await db
      .delete(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, members[1].bottle.id));
    resetQueueMock();

    const result = await updateBottle({
      bottleId: members[0].bottle.id,
      input: {
        name: "New Label",
        statedAge: 15,
        brand: newBrand.id,
        bottler: newBottler.id,
        distillers: newDistillers.map(({ id }) => id),
        series: newSeries.id,
        category: "bourbon",
        flavorProfile: "spicy_sweet",
      },
      context: contextFor(mod),
    });
    expect(result.changed).toBe(true);
    expect(
      vi
        .mocked(workerClient.pushUniqueJob)
        .mock.calls.filter(([jobName]) => jobName === "OnBottleChange")
        .map(([, payload]) => payload),
    ).toEqual(members.map(({ bottle }) => ({ bottleId: bottle.id })));
    expect(result.group).toMatchObject({
      id: first.group.id,
      name: "New Label",
      fullName: "New Shared Brand New Label",
      statedAge: 12,
      brandId: newBrand.id,
      bottlerId: newBottler.id,
      seriesId: newSeries.id,
      category: "bourbon",
      flavorProfile: "spicy_sweet",
      representativeBottleId: representativeBefore,
      ...aggregateBefore,
    });

    const updatedMembers = await loadGroupMembers(first.group.id);
    expect(selectBottleAggregates(updatedMembers)).toEqual(
      bottleAggregatesBefore,
    );
    for (const member of updatedMembers) {
      expect(member).toMatchObject({
        groupId: first.group.id,
        brandId: newBrand.id,
        bottlerId: newBottler.id,
        seriesId: newSeries.id,
        category: "bourbon",
        flavorProfile: "spicy_sweet",
      });
      expect(member.fullName).toMatch(/^New Shared Brand New Label/);
    }
    expect(updatedMembers.map(({ statedAge }) => statedAge)).toEqual([15, 12]);
    const updatedSibling = updatedMembers.find(
      ({ id }) => id === siblingExactBefore.id,
    )!;
    expect(updatedSibling).toMatchObject({
      edition: siblingExactBefore.edition,
      abv: siblingExactBefore.abv,
      caskStrength: siblingExactBefore.caskStrength,
      description: siblingExactBefore.description,
    });
    expect(await loadBottleDistillers(memberIds)).toEqual(
      memberIds.flatMap((bottleId) =>
        newDistillers.map(({ id: distillerId }) => ({ bottleId, distillerId })),
      ),
    );
    const aliasesAfterFanout = await loadAliases(memberIds);
    for (const [bottleId, oldName] of oldNames) {
      expect(aliasesAfterFanout).toContainEqual(
        expect.objectContaining({
          bottleId,
          name: oldName,
        }),
      );
    }

    const repairedMemberId = members[1].bottle.id;
    await db
      .update(bottles)
      .set({
        name: "Temporary Drift",
        fullName: "Temporary Drift Full Name",
        brandId: oldBrand.id,
        bottlerId: oldBottler.id,
        seriesId: oldSeries.id,
        category: "rye",
        flavorProfile: "peated",
      })
      .where(eq(bottles.id, repairedMemberId));
    await db
      .delete(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, repairedMemberId));
    await db.insert(bottlesToDistillers).values({
      bottleId: repairedMemberId,
      distillerId: oldDistiller.id,
    });
    const staleTotalBottles = 99;
    await db
      .update(bottleGroups)
      .set({
        totalBottles: staleTotalBottles,
        representativeBottleId: representativeBefore,
      })
      .where(eq(bottleGroups.id, first.group.id));

    const repair = await updateBottle({
      bottleId: members[0].bottle.id,
      input: {
        name: result.group.name,
        brand: result.group.brandId,
        bottler: result.group.bottlerId,
        distillers: newDistillers.map(({ id }) => id),
        series: result.group.seriesId,
        category: result.group.category,
        flavorProfile: result.group.flavorProfile,
      },
      context: contextFor(mod),
    });
    expect(repair.changed).toBe(true);
    expect(repair.group).toMatchObject({
      totalBottles: staleTotalBottles,
      representativeBottleId: representativeBefore,
    });
    const repaired = (await loadGroupMembers(first.group.id)).find(
      ({ id }) => id === repairedMemberId,
    )!;
    expect(repaired).toMatchObject({
      name: updatedSibling.name,
      fullName: updatedSibling.fullName,
      brandId: newBrand.id,
      bottlerId: newBottler.id,
      seriesId: newSeries.id,
      category: "bourbon",
      flavorProfile: "spicy_sweet",
    });
    expect(
      selectBottleAggregates(await loadGroupMembers(first.group.id)),
    ).toEqual(bottleAggregatesBefore);

    const [groupBeforeNameOnly] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const membersBeforeNameOnly = await loadGroupMembers(first.group.id);
    const distillersBeforeNameOnly = await loadBottleDistillers(memberIds);
    const nameOnly = await updateBottle({
      bottleId: members[0].bottle.id,
      input: { name: "Omission Label" },
      context: contextFor(mod),
    });
    expect(nameOnly.group).toMatchObject({
      name: "Omission Label",
      fullName: "New Shared Brand Omission Label",
      statedAge: groupBeforeNameOnly.statedAge,
      brandId: groupBeforeNameOnly.brandId,
      bottlerId: groupBeforeNameOnly.bottlerId,
      seriesId: groupBeforeNameOnly.seriesId,
      category: groupBeforeNameOnly.category,
      flavorProfile: groupBeforeNameOnly.flavorProfile,
      totalBottles: staleTotalBottles,
      representativeBottleId: representativeBefore,
    });
    const membersAfterNameOnly = await loadGroupMembers(first.group.id);
    for (const [index, member] of membersAfterNameOnly.entries()) {
      const before = membersBeforeNameOnly[index];
      expect(member).toMatchObject({
        id: before.id,
        groupId: before.groupId,
        statedAge: before.statedAge,
        brandId: before.brandId,
        bottlerId: before.bottlerId,
        seriesId: before.seriesId,
        category: before.category,
        flavorProfile: before.flavorProfile,
        edition: before.edition,
        abv: before.abv,
        totalTastings: before.totalTastings,
        avgRating: before.avgRating,
        ratingStats: before.ratingStats,
      });
      expect(member.fullName).toMatch(/^New Shared Brand Omission Label/);
    }
    expect(await loadBottleDistillers(memberIds)).toEqual(
      distillersBeforeNameOnly,
    );
  });

  test("rejects shared fan-out without a representative and rolls back", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Representative Guard Brand" });
    const firstDistiller = await fixtures.Entity({
      name: "Representative Guard Distiller A",
    });
    const secondDistiller = await fixtures.Entity({
      name: "Representative Guard Distiller B",
    });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Representative Guard Label",
        brand: brand.id,
        distillers: [firstDistiller.id],
      },
      exacts: [{ edition: "One" }, { edition: "Two" }],
    });
    const memberIds = members.map(({ bottle }) => bottle.id);

    await db
      .update(bottleGroups)
      .set({ representativeBottleId: null })
      .where(eq(bottleGroups.id, first.group.id));
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const membersBefore = await loadGroupMembers(first.group.id);
    const aliasesBefore = await loadAliases(memberIds);
    const bottleDistillersBefore = await loadBottleDistillers(memberIds);
    const groupDistillersBefore = await db
      .select()
      .from(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, first.group.id))
      .orderBy(asc(bottleGroupDistillers.distillerId));
    resetQueueMock();

    const error = await waitError(
      updateBottle({
        bottleId: members[0].bottle.id,
        input: {
          name: "Must Not Persist",
          distillers: [secondDistiller.id],
        },
        context: contextFor(mod),
      }),
      BottleUpdateGraphError,
    );

    expect(error).toMatchObject({
      bottleId: members[0].bottle.id,
      code: "invalid_catalog_graph",
      groupId: first.group.id,
    });
    expect(
      (
        await db
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, first.group.id))
      )[0],
    ).toEqual(groupBefore);
    expect(await loadGroupMembers(first.group.id)).toEqual(membersBefore);
    expect(await loadAliases(memberIds)).toEqual(aliasesBefore);
    expect(await loadBottleDistillers(memberIds)).toEqual(
      bottleDistillersBefore,
    );
    expect(
      await db
        .select()
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, first.group.id))
        .orderBy(asc(bottleGroupDistillers.distillerId)),
    ).toEqual(groupDistillersBefore);
    expect(await loadUpdateAudits(memberIds)).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();

    resetQueueMock();
    const exactResult = await updateBottle({
      bottleId: members[0].bottle.id,
      input: { description: "Selected Bottle content" },
      context: contextFor(mod),
    });

    expect(exactResult).toMatchObject({
      changed: true,
      bottle: {
        id: members[0].bottle.id,
        description: "Selected Bottle content",
        descriptionSrc: "user",
      },
      group: groupBefore,
    });
    expect(
      (
        await db
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, first.group.id))
      )[0],
    ).toEqual(groupBefore);
    const membersAfterExact = await loadGroupMembers(first.group.id);
    expect(membersAfterExact[0]).toEqual({
      ...membersBefore[0],
      description: "Selected Bottle content",
      descriptionSrc: "user",
      updatedAt: expect.any(Date),
    });
    expect(membersAfterExact[1]).toEqual(membersBefore[1]);
    expect(await loadAliases(memberIds)).toEqual(aliasesBefore);
    expect(await loadBottleDistillers(memberIds)).toEqual(
      bottleDistillersBefore,
    );
    expect(
      await db
        .select()
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, first.group.id))
        .orderBy(asc(bottleGroupDistillers.distillerId)),
    ).toEqual(groupDistillersBefore);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledTimes(1);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: members[0].bottle.id,
    });
  });

  test("writes one contextual Bottle audit per member for a mixed update", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const brand = await fixtures.Entity({ name: "Audit Brand" });
    const firstDistiller = await fixtures.Entity({ name: "Audit Distiller A" });
    const secondDistiller = await fixtures.Entity({
      name: "Audit Distiller B",
    });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Audit Label",
        brand: brand.id,
        distillers: [firstDistiller.id],
      },
      exacts: [{ edition: "One" }, { edition: "Two" }],
    });
    resetQueueMock();

    await updateBottle({
      bottleId: members[0].bottle.id,
      input: {
        name: "Updated Audit Label",
        distillers: [secondDistiller.id],
        edition: "Selected Exact",
      },
      context: contextFor(mod),
    });

    const memberIds = members.map(({ bottle }) => bottle.id);
    const audits = await loadUpdateAudits(memberIds);
    expect(audits).toHaveLength(2);
    const selectedAudit = audits.find(
      ({ objectId }) => objectId === members[0].bottle.id,
    )!;
    const siblingAudit = audits.find(
      ({ objectId }) => objectId === members[1].bottle.id,
    )!;
    expect(selectedAudit).toMatchObject({ actorId: actor.id, type: "update" });
    expect(selectedAudit.data).toMatchObject({
      updateScope: "mixed",
      groupId: first.group.id,
      requestedBottleId: members[0].bottle.id,
      distillerIds: [secondDistiller.id],
      edition: "Selected Exact",
    });
    expect(siblingAudit.data).toMatchObject({
      updateScope: "shared",
      groupId: first.group.id,
      requestedBottleId: members[0].bottle.id,
      distillerIds: [secondDistiller.id],
    });
    expect(siblingAudit.data).not.toHaveProperty("edition");
    expect((await loadGroupMembers(first.group.id))[1].edition).toBe("Two");
  });

  test("normalizes effective ages without sticky equal overrides", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Age Update Brand" });
    const { first, members } = await createGroup({
      user: mod,
      stable: { name: "Age Label", statedAge: 12, brand: brand.id },
      exacts: [
        { edition: "Inherited" },
        { edition: "Override", statedAge: 13 },
        { edition: "Equal", statedAge: 12 },
      ],
    });
    resetQueueMock();

    const changedAge = await updateBottle({
      bottleId: members[0].bottle.id,
      input: { statedAge: 15 },
      context: contextFor(mod),
    });
    expect(changedAge.bottle.statedAge).toBe(15);
    expect(changedAge.group.statedAge).toBe(12);
    let persisted = await loadGroupMembers(first.group.id);
    expect(persisted.map(({ statedAge }) => statedAge)).toEqual([15, 13, 12]);

    const cleared = await updateBottle({
      bottleId: members[1].bottle.id,
      input: { statedAge: null },
      context: contextFor(mod),
    });
    expect(cleared.bottle.statedAge).toBe(12);

    const auditsBeforeEqual = await loadUpdateAudits(
      members.map(({ bottle }) => bottle.id),
    );
    resetQueueMock();
    const equal = await updateBottle({
      bottleId: members[1].bottle.id,
      input: { statedAge: 12 },
      context: contextFor(mod),
    });
    expect(equal.changed).toBe(false);
    expect(
      await loadUpdateAudits(members.map(({ bottle }) => bottle.id)),
    ).toEqual(auditsBeforeEqual);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();

    await updateBottle({
      bottleId: members[2].bottle.id,
      input: { statedAge: 18 },
      context: contextFor(mod),
    });
    persisted = await loadGroupMembers(first.group.id);
    expect(persisted.map(({ statedAge }) => statedAge)).toEqual([15, 12, 18]);

    resetQueueMock();
    const clearedSharedAge = await updateBottle({
      bottleId: members[1].bottle.id,
      input: { statedAge: null },
      context: contextFor(mod),
    });
    expect(clearedSharedAge).toMatchObject({
      bottle: { id: members[1].bottle.id, statedAge: null },
      group: { id: first.group.id, statedAge: null },
      changed: true,
    });
    persisted = await loadGroupMembers(first.group.id);
    expect(persisted.map(({ statedAge }) => statedAge)).toEqual([15, null, 18]);
    expect(
      vi
        .mocked(workerClient.pushUniqueJob)
        .mock.calls.filter(([jobName]) => jobName === "OnBottleChange")
        .map(([, payload]) => payload),
    ).toEqual(members.map(({ bottle }) => ({ bottleId: bottle.id })));
  });

  test("rolls back a shared update on Bottle or exact-alias collisions", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Collision Brand" });
    const distiller = await fixtures.Entity({ name: "Collision Distiller" });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Source Label",
        brand: brand.id,
        distillers: [distiller.id],
      },
      exacts: [{ edition: "One" }, { edition: "Two" }],
    });
    const outsider = await createBottle({
      context: contextFor(mod),
      input: {
        name: "Collision Label",
        brand: brand.id,
        edition: "Two",
      },
    });
    const memberIds = members.map(({ bottle }) => bottle.id);
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const membersBefore = await loadGroupMembers(first.group.id);
    const distillersBefore = await loadBottleDistillers(memberIds);
    const aliasesBefore = await loadAliases(memberIds);
    resetQueueMock();

    const error = await waitError(
      updateBottle({
        bottleId: members[0].bottle.id,
        input: {
          name: "Collision Label",
          distillers: [],
        },
        context: contextFor(mod),
      }),
      BottleUpdateConflictError,
    );
    expect(error).toMatchObject({ conflictingBottleId: outsider.bottle.id });
    expect(
      (
        await db
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, first.group.id))
      )[0],
    ).toEqual(groupBefore);
    expect(await loadGroupMembers(first.group.id)).toEqual(membersBefore);
    expect(await loadBottleDistillers(memberIds)).toEqual(distillersBefore);
    expect(await loadAliases(memberIds)).toEqual(aliasesBefore);
    expect(await loadUpdateAudits(memberIds)).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();

    const aliasOwner = await createBottle({
      context: contextFor(mod),
      input: {
        name: "Unrelated Alias Owner",
        brand: brand.id,
      },
    });
    const conflictingAliasName = "Collision Brand Alias Collision Label - Two";
    expect(aliasOwner.bottle.fullName).not.toBe(conflictingAliasName);
    expect(
      await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.fullName, conflictingAliasName)),
    ).toEqual([]);
    await fixtures.BottleAlias({
      name: conflictingAliasName,
      bottleId: aliasOwner.bottle.id,
      assignmentSource: "human_approved",
    });
    const aliasesBeforeAliasCollision = await loadAliases([
      ...memberIds,
      aliasOwner.bottle.id,
    ]);
    resetQueueMock();

    const aliasError = await waitError(
      updateBottle({
        bottleId: members[0].bottle.id,
        input: {
          name: "Alias Collision Label",
          distillers: [],
        },
        context: contextFor(mod),
      }),
      BottleUpdateConflictError,
    );
    expect(aliasError).toMatchObject({
      conflictingBottleId: aliasOwner.bottle.id,
    });
    expect(
      (
        await db
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, first.group.id))
      )[0],
    ).toEqual(groupBefore);
    expect(await loadGroupMembers(first.group.id)).toEqual(membersBefore);
    expect(await loadBottleDistillers(memberIds)).toEqual(distillersBefore);
    expect(await loadAliases([...memberIds, aliasOwner.bottle.id])).toEqual(
      aliasesBeforeAliasCollision,
    );
    expect(await loadUpdateAudits(memberIds)).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("rejects an equivalent SMWS code without partially updating", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const smws = await fixtures.Entity({
      name: "SMWS",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const existing = await fixtures.Bottle({
      brandId: smws.id,
      bottlerId: smws.id,
      name: "35.331 Ultra hoggie",
    });
    const normalBrand = await fixtures.Entity({ name: "Temporary Brand" });
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Temporary Label", brand: normalBrand.id },
      exacts: [{}],
    });
    await db
      .update(bottleGroups)
      .set({ brandId: smws.id, bottlerId: smws.id })
      .where(eq(bottleGroups.id, first.group.id));
    await db
      .update(bottles)
      .set({ brandId: smws.id, bottlerId: smws.id })
      .where(eq(bottles.id, first.bottle.id));
    resetQueueMock();

    const error = await waitError(
      updateBottle({
        bottleId: first.bottle.id,
        input: { name: "35.331 Alternate hoggie" },
        context: contextFor(mod),
      }),
      BottleUpdateConflictError,
    );
    expect(error).toMatchObject({ conflictingBottleId: existing.id });
    const [persistedGroup] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    expect(persistedGroup.name).toBe(first.group.name);
    expect(await loadUpdateAudits([first.bottle.id])).toEqual([]);
  });

  test("rejects a newly implied SMWS code when the full name is unchanged", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const smws = await fixtures.Entity({
      name: "SMWS",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const existing = await fixtures.Bottle({
      brandId: smws.id,
      bottlerId: smws.id,
      name: "35.331 Existing hoggie",
    });
    const ordinaryBrand = await fixtures.Entity({
      name: "Semantic Collision Brand",
      type: ["brand"],
    });
    const { first } = await createGroup({
      user: mod,
      stable: {
        name: "35.331 Alternate hoggie",
        brand: ordinaryBrand.id,
      },
      exacts: [{}],
    });
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const [bottleBefore] = await loadGroupMembers(first.group.id);
    const aliasesBefore = await loadAliases([first.bottle.id]);
    resetQueueMock();

    const error = await waitError(
      updateBottle({
        bottleId: first.bottle.id,
        input: { bottler: smws.id },
        context: contextFor(mod),
      }),
      BottleUpdateConflictError,
    );

    expect(error).toMatchObject({ conflictingBottleId: existing.id });
    expect(
      (
        await db
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, first.group.id))
      )[0],
    ).toEqual(groupBefore);
    expect(await loadGroupMembers(first.group.id)).toEqual([bottleBefore]);
    expect(await loadAliases([first.bottle.id])).toEqual(aliasesBefore);
    expect(await loadUpdateAudits([first.bottle.id])).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("rejects duplicate desired SMWS codes within a shared fan-out", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const ordinaryBrand = await fixtures.Entity({
      name: "SMWS Fan-out Source Brand",
    });
    const smws = await fixtures.Entity({
      name: "SMWS",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const { first, members } = await createGroup({
      user: mod,
      stable: { name: "Ordinary Shared Label", brand: ordinaryBrand.id },
      exacts: [{ edition: "One" }, { edition: "Two" }],
    });
    const memberIds = members.map(({ bottle }) => bottle.id);
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.group.id));
    const membersBefore = await loadGroupMembers(first.group.id);
    const aliasesBefore = await loadAliases(memberIds);
    resetQueueMock();

    const error = await waitError(
      updateBottle({
        bottleId: members[0].bottle.id,
        input: {
          name: "35.331 Shared hoggie",
          brand: smws.id,
          bottler: smws.id,
        },
        context: contextFor(mod),
      }),
      BottleUpdateConflictError,
    );

    expect(error).toMatchObject({
      conflictingBottleId: members[0].bottle.id,
    });
    expect(
      (
        await db
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, first.group.id))
      )[0],
    ).toEqual(groupBefore);
    expect(await loadGroupMembers(first.group.id)).toEqual(membersBefore);
    expect(await loadAliases(memberIds)).toEqual(aliasesBefore);
    expect(await loadUpdateAudits(memberIds)).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("returns typed graph errors for absent, group-less, and retired Bottles", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const legacy = await fixtures.LegacyBottle();
    const retired = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: null,
    });
    resetQueueMock();

    const cases = [
      { bottleId: 999_999, code: "not_found" },
      { bottleId: legacy.id, code: "missing_group" },
      { bottleId: retired.id, code: "retired" },
    ] as const;
    for (const expected of cases) {
      const error = await waitError(
        updateBottle({
          bottleId: expected.bottleId,
          input: { edition: "Must Not Persist" },
          context: contextFor(mod),
        }),
        BottleUpdateGraphError,
      );
      expect(error).toMatchObject(expected);
    }
    expect(await loadUpdateAudits([legacy.id, retired.id])).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("recomputes old and new series", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Series Update Brand" });
    const oldSeries = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Old Series",
    });
    const newSeries = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "New Series",
    });
    const { first, members } = await createGroup({
      user: mod,
      stable: {
        name: "Series Label",
        brand: brand.id,
        series: oldSeries.id,
      },
      exacts: [{ edition: "One" }, { edition: "Two" }],
    });
    resetQueueMock();

    await updateBottle({
      bottleId: members[0].bottle.id,
      input: { series: newSeries.id },
      context: contextFor(mod),
    });

    const seriesRows = await db
      .select()
      .from(bottleSeries)
      .where(inArray(bottleSeries.id, [oldSeries.id, newSeries.id]));
    expect(
      Object.fromEntries(
        seriesRows.map(({ id, numReleases }) => [id, numReleases]),
      ),
    ).toEqual({ [oldSeries.id]: 0, [newSeries.id]: 2 });
    for (const seriesId of [oldSeries.id, newSeries.id]) {
      expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
        "IndexBottleSeriesSearchVectors",
        { seriesId },
      );
    }
  });

  test("dispatches unique payloads after commit and queue failure does not undo the save", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Dispatch Old Brand" });
    const { first } = await createGroup({
      user: mod,
      stable: { name: "Dispatch Source", brand: brand.id },
      exacts: [{ edition: "One" }],
    });
    resetQueueMock();
    let observedCommittedState = false;
    vi.mocked(workerClient.pushUniqueJob).mockImplementation(
      async (jobName, payload) => {
        if (jobName === "OnBottleChange") {
          const [persisted] = await db
            .select()
            .from(bottles)
            .where(eq(bottles.id, first.bottle.id));
          observedCommittedState = persisted.fullName.startsWith(
            "Dispatch New Brand Dispatch Updated",
          );
          throw new Error("queue unavailable");
        }
        expect(payload).toBeDefined();
      },
    );

    const result = await updateBottle({
      bottleId: first.bottle.id,
      input: {
        name: "Dispatch Updated",
        brand: { name: "Dispatch New Brand" },
        distillers: [{ name: "Dispatch New Distillery" }],
        series: { name: "Dispatch New Series" },
      },
      context: contextFor(mod),
    });
    expect(result.changed).toBe(true);
    expect(observedCommittedState).toBe(true);
    expect(result.bottle.fullName).toMatch(
      /^Dispatch New Brand Dispatch Updated/,
    );

    const createdEntities = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(
        inArray(entities.name, [
          "Dispatch New Brand",
          "Dispatch New Distillery",
        ]),
      );
    const [createdSeries] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.name, "Dispatch New Series"));
    const calls = vi.mocked(workerClient.pushUniqueJob).mock.calls;
    const payloadsFor = (jobName: string) =>
      calls
        .filter(([calledJobName]) => calledJobName === jobName)
        .map(([, payload]) => JSON.stringify(payload));
    for (const jobName of [
      "OnBottleChange",
      "OnBottleAliasChange",
      "OnEntityChange",
      "VerifyEntityCreation",
      "IndexBottleSeriesSearchVectors",
    ]) {
      const payloads = payloadsFor(jobName);
      expect(new Set(payloads).size).toBe(payloads.length);
    }
    expect(payloadsFor("OnBottleChange")).toEqual([
      JSON.stringify({ bottleId: first.bottle.id }),
    ]);
    const entityPayloads = [brand.id, ...createdEntities.map(({ id }) => id)]
      .map((entityId) => JSON.stringify({ entityId }))
      .sort();
    const verificationPayloads = createdEntities
      .map(({ id }) =>
        JSON.stringify({ entityId: id, creationSource: "manual_entry" }),
      )
      .sort();
    expect(payloadsFor("OnEntityChange").sort()).toEqual(entityPayloads);
    expect(payloadsFor("VerifyEntityCreation").sort()).toEqual(
      verificationPayloads,
    );
    expect(payloadsFor("IndexBottleSeriesSearchVectors")).toEqual([
      JSON.stringify({ seriesId: createdSeries.id }),
    ]);
  });
});
