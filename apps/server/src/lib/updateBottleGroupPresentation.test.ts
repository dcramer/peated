import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  actors,
  bottleAliases,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  catalogTargets,
  changes,
  tastings,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import waitError from "@peated/server/lib/test/waitError";
import {
  BottleGroupPresentationAuthorizationError,
  BottleGroupPresentationGraphError,
  BottleGroupPresentationInputError,
  updateBottleGroupPresentation,
} from "@peated/server/lib/updateBottleGroupPresentation";
import * as workerClient from "@peated/server/worker/client";
import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZodError } from "zod";

function contextFor(user: User | null) {
  return {
    user,
  } as Parameters<typeof updateBottleGroupPresentation>[0]["context"];
}

let groupFixtureSequence = 0;

async function createGroup({
  user,
  fixtures,
}: {
  user: User;
  fixtures: {
    Entity: (data?: Record<string, unknown>) => Promise<{ id: number }>;
  };
}) {
  groupFixtureSequence += 1;
  const brand = await fixtures.Entity({
    name: `Presentation Test Brand ${groupFixtureSequence}`,
  });
  const first = await createConcreteBottle({
    context: contextFor(user) as Parameters<
      typeof createConcreteBottle
    >[0]["context"],
    input: {
      kind: "independent",
      stable: { name: "Presentation Expression", brand: brand.id },
      exact: {
        edition: "First Edition",
        description: "First Bottle editorial",
      },
    },
  });
  const second = await createConcreteBottle({
    context: contextFor(user) as Parameters<
      typeof createConcreteBottle
    >[0]["context"],
    input: {
      kind: "source_bottle",
      sourceBottleId: first.bottle.id,
      exact: {
        edition: "Second Edition",
        description: "Second Bottle editorial",
      },
    },
  });
  const [firstBottle] = await db
    .update(bottles)
    .set({
      tastingNotes: {
        nose: "First nose",
        palate: "First palate",
        finish: "First finish",
      },
    })
    .where(eq(bottles.id, first.bottle.id))
    .returning();
  const [secondBottle] = await db
    .update(bottles)
    .set({
      tastingNotes: {
        nose: "Second nose",
        palate: "Second palate",
        finish: "Second finish",
      },
    })
    .where(eq(bottles.id, second.bottle.id))
    .returning();
  return {
    first: { ...first, bottle: firstBottle },
    second: { ...second, bottle: secondBottle },
  };
}

async function loadGroup(groupId: number) {
  return await db.query.bottleGroups.findFirst({
    where: eq(bottleGroups.id, groupId),
  });
}

async function loadPresentationAudits(groupId: number) {
  return await db
    .select()
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "bottle_group"),
        eq(changes.objectId, groupId),
        eq(changes.type, "update"),
      ),
    )
    .orderBy(asc(changes.id));
}

function resetQueueMock() {
  vi.mocked(workerClient.pushUniqueJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockResolvedValue(undefined);
}

describe("BottleGroup presentation updates", () => {
  beforeEach(() => {
    resetQueueMock();
  });

  test("authorizes before parsing and strictly validates IDs and patch fields", async ({
    defaults,
    fixtures,
  }) => {
    const group = await createGroup({ user: defaults.user, fixtures });
    const groupId = group.first.group.id;
    const invalidInput = { representativeBottleId: null, stableName: "no" };

    for (const user of [null, defaults.user]) {
      const error = await waitError(
        updateBottleGroupPresentation({
          groupId,
          input: invalidInput,
          context: contextFor(user),
        }),
        BottleGroupPresentationAuthorizationError,
      );
      expect(error).toBeInstanceOf(BottleGroupPresentationAuthorizationError);
    }

    const mod = await fixtures.User({ mod: true });
    const admin = await fixtures.User({ admin: true });
    await expect(
      updateBottleGroupPresentation({
        groupId,
        input: {},
        context: contextFor(mod),
      }),
    ).resolves.toMatchObject({ changed: false });
    await expect(
      updateBottleGroupPresentation({
        groupId,
        input: {},
        context: contextFor(admin),
      }),
    ).resolves.toMatchObject({ changed: false });

    for (const invalidGroupId of [0, -1, 1.5, Number.NaN]) {
      const error = await waitError(
        updateBottleGroupPresentation({
          groupId: invalidGroupId,
          input: {},
          context: contextFor(mod),
        }),
        BottleGroupPresentationInputError,
      );
      expect(error).toBeInstanceOf(BottleGroupPresentationInputError);
    }

    for (const input of [
      invalidInput,
      { representativeBottleId: 0 },
      { representativeBottleId: 1.5 },
      { description: 123 },
      { descriptionSrc: "crawler" },
      { imageUrl: "not-a-url" },
      { tastingNotes: { nose: "n", palate: "p" } },
      {
        tastingNotes: {
          nose: "n",
          palate: "p",
          finish: "f",
          unknown: true,
        },
      },
      { suggestedTags: ["not-owned"] },
      { avgRating: 2 },
      { name: "Stable identity is not presentation" },
    ]) {
      const error = await waitError(
        updateBottleGroupPresentation({
          groupId,
          input,
          context: contextFor(mod),
        }),
        ZodError,
      );
      expect(error).toBeInstanceOf(ZodError);
    }
  });

  test("changes the representative only to another active member without copying Bottle content", async ({
    defaults,
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first, second } = await createGroup({
      user: defaults.user,
      fixtures,
    });
    const initialEditorial = {
      description: "Group-owned description",
      descriptionSrc: "generated" as const,
      imageUrl: "https://example.com/group.webp",
      tastingNotes: {
        nose: "Group nose",
        palate: "Group palate",
        finish: "Group finish",
      },
    };
    await db
      .update(bottleGroups)
      .set(initialEditorial)
      .where(eq(bottleGroups.id, first.group.id));

    const result = await updateBottleGroupPresentation({
      groupId: first.group.id,
      input: { representativeBottleId: second.bottle.id },
      context: contextFor(mod),
    });

    expect(result).toMatchObject({
      changed: true,
      group: {
        representativeBottleId: second.bottle.id,
        ...initialEditorial,
      },
    });
    expect(result.group.description).not.toBe(second.bottle.description);
    expect(result.group.tastingNotes).not.toEqual(second.bottle.tastingNotes);
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, second.bottle.id),
      }),
    ).toEqual(second.bottle);
  });

  test("rejects foreign, missing, or retired representatives and rolls back editorial changes", async ({
    defaults,
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const source = await createGroup({ user: defaults.user, fixtures });
    const foreign = await createGroup({ user: defaults.user, fixtures });
    await db.insert(bottleTombstones).values({
      bottleId: source.second.bottle.id,
      newBottleId: source.first.bottle.id,
    });

    const attempts = [
      {
        bottleId: foreign.first.bottle.id,
        code: "representative_not_member",
      },
      { bottleId: 999_991, code: "representative_not_found" },
      {
        bottleId: source.second.bottle.id,
        code: "representative_retired",
      },
    ] as const;
    for (const attempt of attempts) {
      const before = await loadGroup(source.first.group.id);
      const error = await waitError(
        updateBottleGroupPresentation({
          groupId: source.first.group.id,
          input: {
            representativeBottleId: attempt.bottleId,
            description: "Must roll back",
          },
          context: contextFor(mod),
        }),
        BottleGroupPresentationGraphError,
      );
      expect(error).toMatchObject({
        code: attempt.code,
        groupId: source.first.group.id,
        bottleId: attempt.bottleId,
      });
      expect(await loadGroup(source.first.group.id)).toEqual(before);
      expect(await loadPresentationAudits(source.first.group.id)).toEqual([]);
    }
  });

  test("distinguishes missing and retired groups and rejects a retired current representative", async ({
    defaults,
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const active = await createGroup({ user: defaults.user, fixtures });
    const actor = await getUserActor(mod);
    const retiredGroupId = 999_981;
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupId,
      newGroupId: active.first.group.id,
      createdByActorId: actor.id,
    });

    for (const [groupId, code] of [
      [999_982, "not_found"],
      [retiredGroupId, "retired"],
    ] as const) {
      const error = await waitError(
        updateBottleGroupPresentation({
          groupId,
          input: { description: "No write" },
          context: contextFor(mod),
        }),
        BottleGroupPresentationGraphError,
      );
      expect(error).toMatchObject({ code, groupId, bottleId: null });
    }

    await db.insert(bottleTombstones).values({
      bottleId: active.first.bottle.id,
      newBottleId: active.second.bottle.id,
    });
    const graphError = await waitError(
      updateBottleGroupPresentation({
        groupId: active.first.group.id,
        input: { description: "No write" },
        context: contextFor(mod),
      }),
      BottleGroupPresentationGraphError,
    );
    expect(graphError).toMatchObject({
      code: "invalid_catalog_graph",
      groupId: active.first.group.id,
      bottleId: active.first.bottle.id,
    });
    expect(await loadPresentationAudits(active.first.group.id)).toEqual([]);
  });

  test("sets and deliberately clears group editorial fields with exact description source semantics", async ({
    defaults,
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first } = await createGroup({ user: defaults.user, fixtures });
    const tastingNotes = {
      nose: "Group nose",
      palate: "Group palate",
      finish: "Group finish",
    };

    const setResult = await updateBottleGroupPresentation({
      groupId: first.group.id,
      input: {
        description: "Moderator description",
        imageUrl: "https://example.com/editorial.webp",
        tastingNotes,
      },
      context: contextFor(mod),
    });
    expect(setResult.group).toMatchObject({
      description: "Moderator description",
      descriptionSrc: "user",
      imageUrl: "https://example.com/editorial.webp",
      tastingNotes,
    });

    const generatedResult = await updateBottleGroupPresentation({
      groupId: first.group.id,
      input: {
        description: "Generated description",
        descriptionSrc: "generated",
      },
      context: contextFor(mod),
    });
    expect(generatedResult.group).toMatchObject({
      description: "Generated description",
      descriptionSrc: "generated",
      imageUrl: "https://example.com/editorial.webp",
      tastingNotes,
    });

    const clearResult = await updateBottleGroupPresentation({
      groupId: first.group.id,
      input: {
        description: null,
        imageUrl: null,
        tastingNotes: null,
      },
      context: contextFor(mod),
    });
    expect(clearResult.group).toMatchObject({
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      tastingNotes: null,
    });
  });

  test("updates representative and editorial fields atomically with one reversible audit", async ({
    defaults,
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const { first, second } = await createGroup({
      user: defaults.user,
      fixtures,
    });
    const before = await loadGroup(first.group.id);
    if (!before) throw new Error("Expected BottleGroup fixture.");

    const result = await updateBottleGroupPresentation({
      groupId: first.group.id,
      input: {
        representativeBottleId: second.bottle.id,
        description: "Atomic editorial",
        imageUrl: "https://example.com/atomic.webp",
        tastingNotes: { nose: "n", palate: "p", finish: "f" },
      },
      context: contextFor(mod),
    });
    const audits = await loadPresentationAudits(first.group.id);

    expect(result.changed).toBe(true);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      objectType: "bottle_group",
      objectId: first.group.id,
      actorId: actor.id,
      displayName: first.group.fullName,
      type: "update",
      data: {
        updateScope: "group_presentation",
        before: {
          representativeBottleId: first.bottle.id,
          description: before.description,
          descriptionSrc: before.descriptionSrc,
          imageUrl: before.imageUrl,
          tastingNotes: before.tastingNotes,
        },
        after: {
          representativeBottleId: second.bottle.id,
          description: "Atomic editorial",
          descriptionSrc: "user",
          imageUrl: "https://example.com/atomic.webp",
          tastingNotes: { nose: "n", palate: "p", finish: "f" },
        },
      },
    });
    expect((audits[0].data.before as Record<string, unknown>).updatedAt).toBe(
      before.updatedAt.toISOString(),
    );
    expect((audits[0].data.after as Record<string, unknown>).updatedAt).toBe(
      result.group.updatedAt.toISOString(),
    );
  });

  test("does not mutate member Bottles, targets, aliases, activity, identity, or aggregates", async ({
    defaults,
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first, second } = await createGroup({
      user: defaults.user,
      fixtures,
    });
    const groupId = first.group.id;
    const memberIds = [first.bottle.id, second.bottle.id];
    await db
      .update(bottleGroups)
      .set({
        suggestedTags: ["group-tag"],
        avgRating: 1,
        totalTastings: 7,
        totalBottles: 2,
      })
      .where(eq(bottleGroups.id, groupId));
    const targets = await db
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.groupId, groupId))
      .orderBy(asc(catalogTargets.id));
    const genericTarget = targets.find(({ bottleId }) => bottleId === null);
    const secondTarget = targets.find(
      ({ bottleId }) => bottleId === second.bottle.id,
    );
    if (!genericTarget || !secondTarget) throw new Error("Expected targets.");
    await fixtures.BottleAlias({
      bottleId: second.bottle.id,
      targetId: secondTarget.id,
      name: "Protected exact alias",
    });
    await fixtures.BottleAlias({
      bottleId: first.bottle.id,
      targetId: genericTarget.id,
      name: "Protected stable alias",
    });
    await fixtures.Tasting({
      bottleId: first.bottle.id,
      targetId: genericTarget.id,
    });
    await fixtures.Tasting({
      bottleId: second.bottle.id,
      targetId: secondTarget.id,
    });

    const beforeGroup = await loadGroup(groupId);
    const beforeMembers = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, memberIds))
      .orderBy(asc(bottles.id));
    const beforeTargets = await db
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.groupId, groupId))
      .orderBy(asc(catalogTargets.id));
    const beforeAliases = await db
      .select()
      .from(bottleAliases)
      .where(inArray(bottleAliases.bottleId, memberIds))
      .orderBy(asc(bottleAliases.name));
    const beforeTastings = await db
      .select()
      .from(tastings)
      .where(
        inArray(
          tastings.targetId,
          targets.map(({ id }) => id),
        ),
      )
      .orderBy(asc(tastings.id));
    resetQueueMock();

    await updateBottleGroupPresentation({
      groupId,
      input: {
        representativeBottleId: second.bottle.id,
        description: "Presentation only",
      },
      context: contextFor(mod),
    });

    expect(
      await db
        .select()
        .from(bottles)
        .where(inArray(bottles.id, memberIds))
        .orderBy(asc(bottles.id)),
    ).toEqual(beforeMembers);
    expect(
      await db
        .select()
        .from(catalogTargets)
        .where(eq(catalogTargets.groupId, groupId))
        .orderBy(asc(catalogTargets.id)),
    ).toEqual(beforeTargets);
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(inArray(bottleAliases.bottleId, memberIds))
        .orderBy(asc(bottleAliases.name)),
    ).toEqual(beforeAliases);
    expect(
      await db
        .select()
        .from(tastings)
        .where(
          inArray(
            tastings.targetId,
            targets.map(({ id }) => id),
          ),
        )
        .orderBy(asc(tastings.id)),
    ).toEqual(beforeTastings);
    const afterGroup = await loadGroup(groupId);
    expect(afterGroup).toMatchObject({
      name: beforeGroup?.name,
      fullName: beforeGroup?.fullName,
      brandId: beforeGroup?.brandId,
      bottlerId: beforeGroup?.bottlerId,
      statedAge: beforeGroup?.statedAge,
      seriesId: beforeGroup?.seriesId,
      category: beforeGroup?.category,
      flavorProfile: beforeGroup?.flavorProfile,
      suggestedTags: beforeGroup?.suggestedTags,
      avgRating: beforeGroup?.avgRating,
      ratingStats: beforeGroup?.ratingStats,
      totalTastings: beforeGroup?.totalTastings,
      totalBottles: beforeGroup?.totalBottles,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("an exact no-op preserves updatedAt and writes no audit", async ({
    defaults,
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first } = await createGroup({ user: defaults.user, fixtures });
    const oldUpdatedAt = new Date("2020-01-02T03:04:05.000Z");
    const [group] = await db
      .update(bottleGroups)
      .set({
        description: "Already set",
        descriptionSrc: "generated",
        imageUrl: "https://example.com/already.webp",
        tastingNotes: { nose: "n", palate: "p", finish: "f" },
        updatedAt: oldUpdatedAt,
      })
      .where(eq(bottleGroups.id, first.group.id))
      .returning();
    const actorsBefore = await db
      .select()
      .from(actors)
      .where(eq(actors.userId, mod.id))
      .orderBy(asc(actors.id));
    resetQueueMock();

    const result = await updateBottleGroupPresentation({
      groupId: first.group.id,
      input: {
        representativeBottleId: group.representativeBottleId as number,
        description: group.description,
        descriptionSrc: group.descriptionSrc,
        imageUrl: group.imageUrl,
        tastingNotes: group.tastingNotes,
      },
      context: contextFor(mod),
    });

    expect(result).toEqual({ group, changed: false });
    expect((await loadGroup(first.group.id))?.updatedAt).toEqual(oldUpdatedAt);
    expect(await loadPresentationAudits(first.group.id)).toEqual([]);
    expect(
      await db
        .select()
        .from(actors)
        .where(eq(actors.userId, mod.id))
        .orderBy(asc(actors.id)),
    ).toEqual(actorsBefore);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });
});
