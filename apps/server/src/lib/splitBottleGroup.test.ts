import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  catalogTargets,
  changes,
  tastings,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import {
  BottleGroupSplitAuthorizationError,
  type BottleGroupSplitConflictError,
  BottleGroupSplitGraphError,
  BottleGroupSplitInputError,
  splitBottleGroup,
} from "@peated/server/lib/splitBottleGroup";
import waitError from "@peated/server/lib/test/waitError";
import { asc, eq, inArray } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

function contextFor(user: User | null) {
  return { user } as Parameters<typeof splitBottleGroup>[0]["context"];
}

let groupSequence = 0;

async function createGroup({
  user,
  fixtures,
  count = 3,
  withDistiller = true,
}: {
  user: User;
  fixtures: {
    Entity: (data?: Record<string, unknown>) => Promise<{ id: number }>;
  };
  count?: number;
  withDistiller?: boolean;
}) {
  groupSequence += 1;
  const brand = await fixtures.Entity({
    name: `Split Brand ${groupSequence}`,
  });
  const distiller = withDistiller
    ? await fixtures.Entity({ name: `Split Distiller ${groupSequence}` })
    : null;
  const stable = {
    name: `Split Expression ${groupSequence}`,
    statedAge: 12,
    brand: brand.id,
    distillers: distiller ? [distiller.id] : [],
    category: "single_malt",
    flavorProfile: "peated",
  };
  const first = await createConcreteBottle({
    context: contextFor(user) as Parameters<
      typeof createConcreteBottle
    >[0]["context"],
    input: {
      kind: "independent",
      stable,
      exact: { edition: "Batch 1", abv: 46 },
    },
  });
  const members = [first];
  for (let index = 2; index <= count; index += 1) {
    members.push(
      await createConcreteBottle({
        context: contextFor(user) as Parameters<
          typeof createConcreteBottle
        >[0]["context"],
        input: {
          kind: "source_bottle",
          sourceBottleId: first.bottle.id,
          exact: {
            edition: `Batch ${index}`,
            releaseYear: 2020 + index,
            abv: 45 + index,
          },
        },
      }),
    );
  }
  return { first, members, distiller };
}

async function targetsFor(groupId: number) {
  return await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, groupId))
    .orderBy(asc(catalogTargets.id));
}

async function auditCounts() {
  return {
    groups: (await db.select({ id: bottleGroups.id }).from(bottleGroups))
      .length,
    changes: (await db.select({ id: changes.id }).from(changes)).length,
  };
}

async function splitAuditCount() {
  return (await db.select({ data: changes.data }).from(changes)).filter(
    ({ data }) => data.updateScope === "group_split",
  ).length;
}

async function bottleMemberships() {
  return await db
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .orderBy(asc(bottles.id));
}

describe("BottleGroup splits", () => {
  test("authorizes before strictly parsing positive, unique split input", async ({
    defaults,
    fixtures,
  }) => {
    for (const user of [null, defaults.user]) {
      expect(
        await waitError(
          splitBottleGroup({
            sourceGroupId: 0,
            input: { movedBottleIds: [] },
            context: contextFor(user),
          }),
        ),
      ).toBeInstanceOf(BottleGroupSplitAuthorizationError);
    }

    const mod = await fixtures.User({ mod: true });
    expect(
      await waitError(
        splitBottleGroup({
          sourceGroupId: 0,
          input: {
            movedBottleIds: [1],
            newRepresentativeBottleId: 1,
          },
          context: contextFor(mod),
        }),
      ),
    ).toBeInstanceOf(BottleGroupSplitInputError);

    for (const input of [
      { movedBottleIds: [], newRepresentativeBottleId: 1 },
      { movedBottleIds: [1, 1], newRepresentativeBottleId: 1 },
      { movedBottleIds: [0], newRepresentativeBottleId: 1 },
      { movedBottleIds: [1], newRepresentativeBottleId: 0 },
      {
        movedBottleIds: [1],
        newRepresentativeBottleId: 1,
        unexpected: true,
      },
    ]) {
      expect(
        await waitError(
          splitBottleGroup({
            sourceGroupId: 1,
            input,
            context: contextFor(mod),
          }),
        ),
      ).toBeInstanceOf(ZodError);
    }
  });

  test("distinguishes missing and retired source groups without writing split state", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const source = await createGroup({ user: mod, fixtures });
    const destination = await createGroup({ user: mod, fixtures, count: 1 });
    const movedBottleId = source.members[1]!.bottle.id;

    const missingBefore = {
      counts: await auditCounts(),
      splitAudits: await splitAuditCount(),
      memberships: await bottleMemberships(),
    };
    expect(
      await waitError(
        splitBottleGroup({
          sourceGroupId: 999_999,
          input: {
            movedBottleIds: [movedBottleId],
            newRepresentativeBottleId: movedBottleId,
          },
          context: contextFor(mod),
        }),
      ),
    ).toMatchObject({ code: "not_found", groupId: 999_999 });
    expect({
      counts: await auditCounts(),
      splitAudits: await splitAuditCount(),
      memberships: await bottleMemberships(),
    }).toEqual(missingBefore);

    await db.insert(bottleGroupTombstones).values({
      groupId: source.first.group.id,
      newGroupId: destination.first.group.id,
      createdByActorId: actor.id,
    });
    const retiredBefore = {
      counts: await auditCounts(),
      splitAudits: await splitAuditCount(),
      memberships: await bottleMemberships(),
    };
    expect(
      await waitError(
        splitBottleGroup({
          sourceGroupId: source.first.group.id,
          input: {
            movedBottleIds: [movedBottleId],
            newRepresentativeBottleId: movedBottleId,
          },
          context: contextFor(mod),
        }),
      ),
    ).toMatchObject({ code: "retired", groupId: source.first.group.id });
    expect({
      counts: await auditCounts(),
      splitAudits: await splitAuditCount(),
      memberships: await bottleMemberships(),
    }).toEqual(retiredBefore);
  });

  test("splits one member without changing exact identity or source-owned generic data", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const group = await createGroup({ user: mod, fixtures });
    const sourceGroupId = group.first.group.id;
    const movedId = group.members[1]!.bottle.id;
    const sourceRepresentativeId = group.members[0]!.bottle.id;

    await db
      .update(bottleGroups)
      .set({
        description: "Source editorial",
        descriptionSrc: "user",
        imageUrl: "https://example.com/source.jpg",
        tastingNotes: { nose: "n", palate: "p", finish: "f" },
        suggestedTags: ["source-tag"],
      })
      .where(eq(bottleGroups.id, sourceGroupId));
    const sourceTargetsBefore = await targetsFor(sourceGroupId);
    const genericTarget = sourceTargetsBefore.find(
      ({ bottleId }) => bottleId === null,
    )!;
    const exactTarget = sourceTargetsBefore.find(
      ({ bottleId }) => bottleId === movedId,
    )!;
    await db.insert(bottleAliases).values({
      name: `Stable Split Alias ${groupSequence}`,
      targetId: genericTarget.id,
      assignedByActorId: actor.id,
      assignmentSource: "human_approved",
    });
    const genericTastingAt = new Date("2026-01-01T00:00:00.000Z");
    const exactTastingAt = new Date("2026-01-02T00:00:00.000Z");
    await db.insert(tastings).values([
      {
        bottleId: sourceRepresentativeId,
        targetId: genericTarget.id,
        rating: SIMPLE_RATING_VALUES.SIP,
        createdById: mod.id,
        createdAt: genericTastingAt,
      },
      {
        bottleId: movedId,
        targetId: exactTarget.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
        createdById: mod.id,
        createdAt: exactTastingAt,
      },
    ]);

    const [sourceBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, sourceGroupId));
    const membersBefore = await db
      .select()
      .from(bottles)
      .where(eq(bottles.groupId, sourceGroupId))
      .orderBy(asc(bottles.id));
    const bottleDistillersBefore = await db
      .select()
      .from(bottlesToDistillers)
      .where(
        inArray(
          bottlesToDistillers.bottleId,
          membersBefore.map(({ id }) => id),
        ),
      )
      .orderBy(
        asc(bottlesToDistillers.bottleId),
        asc(bottlesToDistillers.distillerId),
      );
    const sourceGroupDistillersBefore = await db
      .select()
      .from(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, sourceGroupId))
      .orderBy(asc(bottleGroupDistillers.distillerId));
    const aliasesBefore = await db
      .select()
      .from(bottleAliases)
      .orderBy(asc(bottleAliases.name));
    const result = await splitBottleGroup({
      sourceGroupId,
      input: {
        movedBottleIds: [movedId],
        newRepresentativeBottleId: movedId,
      },
      context: contextFor(mod),
    });

    expect(result).toMatchObject({
      sourceGroupId,
      movedBottleIds: [movedId],
      sourceRepresentativeBottleId: sourceRepresentativeId,
      newRepresentativeBottleId: movedId,
    });
    const [sourceAfter, newGroup] = await db
      .select()
      .from(bottleGroups)
      .where(inArray(bottleGroups.id, [sourceGroupId, result.newGroupId]))
      .orderBy(asc(bottleGroups.id));
    expect(sourceAfter).toMatchObject({
      id: sourceGroupId,
      representativeBottleId: sourceRepresentativeId,
      description: "Source editorial",
      imageUrl: "https://example.com/source.jpg",
      suggestedTags: ["source-tag"],
      totalBottles: 2,
      totalTastings: 1,
      avgRating: SIMPLE_RATING_VALUES.SIP,
      ratingStats: {
        pass: 0,
        sip: 1,
        savor: 0,
        total: 1,
        avg: SIMPLE_RATING_VALUES.SIP,
        percentage: { pass: 0, sip: 100, savor: 0 },
      },
    });
    expect(newGroup).toMatchObject({
      id: result.newGroupId,
      fullName: sourceBefore!.fullName,
      name: sourceBefore!.name,
      statedAge: sourceBefore!.statedAge,
      seriesId: sourceBefore!.seriesId,
      category: sourceBefore!.category,
      brandId: sourceBefore!.brandId,
      bottlerId: sourceBefore!.bottlerId,
      flavorProfile: sourceBefore!.flavorProfile,
      representativeBottleId: movedId,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      tastingNotes: null,
      suggestedTags: [],
      totalBottles: 1,
      totalTastings: 1,
      avgRating: SIMPLE_RATING_VALUES.SAVOR,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 1,
        total: 1,
        avg: SIMPLE_RATING_VALUES.SAVOR,
        percentage: { pass: 0, sip: 0, savor: 100 },
      },
      createdByActorId: actor.id,
    });

    const groupDistillersAfter = await db
      .select()
      .from(bottleGroupDistillers)
      .where(
        inArray(bottleGroupDistillers.groupId, [
          sourceGroupId,
          result.newGroupId,
        ]),
      )
      .orderBy(
        asc(bottleGroupDistillers.groupId),
        asc(bottleGroupDistillers.distillerId),
      );
    expect(
      groupDistillersAfter.filter(({ groupId }) => groupId === sourceGroupId),
    ).toEqual(sourceGroupDistillersBefore);
    expect(
      groupDistillersAfter
        .filter(({ groupId }) => groupId === result.newGroupId)
        .map(({ distillerId }) => distillerId),
    ).toEqual(
      sourceGroupDistillersBefore.map(({ distillerId }) => distillerId),
    );

    const membersAfter = await db
      .select()
      .from(bottles)
      .where(
        inArray(
          bottles.id,
          membersBefore.map(({ id }) => id),
        ),
      )
      .orderBy(asc(bottles.id));
    for (const before of membersBefore) {
      const after = membersAfter.find(({ id }) => id === before.id)!;
      if (before.id === movedId) {
        expect(after.groupId).toBe(result.newGroupId);
        expect({
          ...after,
          groupId: before.groupId,
          updatedAt: before.updatedAt,
        }).toEqual(before);
      } else {
        expect(after).toEqual(before);
      }
    }

    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(
          inArray(
            bottlesToDistillers.bottleId,
            membersBefore.map(({ id }) => id),
          ),
        )
        .orderBy(
          asc(bottlesToDistillers.bottleId),
          asc(bottlesToDistillers.distillerId),
        ),
    ).toEqual(bottleDistillersBefore);
    expect(
      await db.select().from(bottleAliases).orderBy(asc(bottleAliases.name)),
    ).toEqual(aliasesBefore);

    const sourceTargetsAfter = await targetsFor(sourceGroupId);
    const newTargets = await targetsFor(result.newGroupId);
    expect(
      sourceTargetsAfter.find(({ bottleId }) => bottleId === null),
    ).toEqual(genericTarget);
    expect(newTargets).toHaveLength(2);
    expect(
      newTargets.find(({ bottleId }) => bottleId === movedId),
    ).toMatchObject({
      id: exactTarget.id,
      groupId: result.newGroupId,
    });
    expect(newTargets.find(({ bottleId }) => bottleId === null)?.id).not.toBe(
      genericTarget.id,
    );
    const persistedTastings = await db
      .select()
      .from(tastings)
      .orderBy(asc(tastings.createdAt));
    expect(persistedTastings.map(({ targetId }) => targetId)).toEqual([
      genericTarget.id,
      exactTarget.id,
    ]);

    const splitAudits = (
      await db
        .select()
        .from(changes)
        .where(
          inArray(changes.objectId, [
            sourceGroupId,
            result.newGroupId,
            movedId,
          ]),
        )
        .orderBy(asc(changes.id))
    ).filter(({ data }) => data.updateScope === "group_split");
    expect(splitAudits).toHaveLength(3);
    const bottleAudit = splitAudits.find(
      ({ objectType }) => objectType === "bottle",
    )!;
    expect(bottleAudit).toMatchObject({
      objectId: movedId,
      actorId: actor.id,
      type: "update",
    });
    expect(bottleAudit.data).toMatchObject({
      sourceGroupId,
      newGroupId: result.newGroupId,
      before: {
        groupId: sourceGroupId,
        targetId: exactTarget.id,
        distillerIds: group.distiller ? [group.distiller.id] : [],
      },
      after: {
        groupId: result.newGroupId,
        targetId: exactTarget.id,
        distillerIds: group.distiller ? [group.distiller.id] : [],
      },
    });
    const sourceAudit = splitAudits.find(
      ({ objectType, type }) =>
        objectType === "bottle_group" && type === "update",
    )!;
    expect(sourceAudit.data).toMatchObject({
      movedBottleIds: [movedId],
      before: {
        representativeBottleId: sourceRepresentativeId,
        genericTarget: { id: genericTarget.id },
      },
      after: {
        representativeBottleId: sourceRepresentativeId,
        genericTarget: { id: genericTarget.id },
        totalBottles: 2,
        totalTastings: 1,
      },
    });
    const addAudit = splitAudits.find(
      ({ objectType, type }) => objectType === "bottle_group" && type === "add",
    )!;
    expect(addAudit.data).toMatchObject({
      sourceGroupId,
      movedBottleIds: [movedId],
      after: {
        id: result.newGroupId,
        representativeBottleId: movedId,
        totalBottles: 1,
        totalTastings: 1,
        distillerIds: group.distiller ? [group.distiller.id] : [],
      },
    });
  });

  test("moves multiple members and requires a surviving representative", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const group = await createGroup({ user: mod, fixtures });
    const [first, second, third] = group.members;
    const movedBottleIds = [first!.bottle.id, second!.bottle.id];

    expect(
      await waitError(
        splitBottleGroup({
          sourceGroupId: group.first.group.id,
          input: {
            movedBottleIds,
            newRepresentativeBottleId: second!.bottle.id,
          },
          context: contextFor(mod),
        }),
      ),
    ).toMatchObject({ code: "source_representative_required" });

    const result = await splitBottleGroup({
      sourceGroupId: group.first.group.id,
      input: {
        movedBottleIds: [...movedBottleIds].reverse(),
        newRepresentativeBottleId: second!.bottle.id,
        sourceRepresentativeBottleId: third!.bottle.id,
      },
      context: contextFor(mod),
    });
    expect(result).toMatchObject({
      movedBottleIds,
      sourceRepresentativeBottleId: third!.bottle.id,
      newRepresentativeBottleId: second!.bottle.id,
    });
    const moved = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, movedBottleIds))
      .orderBy(asc(bottles.id));
    expect(moved.map(({ groupId }) => groupId)).toEqual([
      result.newGroupId,
      result.newGroupId,
    ]);
    const persistedGroups = await db
      .select({
        id: bottleGroups.id,
        representativeBottleId: bottleGroups.representativeBottleId,
      })
      .from(bottleGroups)
      .where(
        inArray(bottleGroups.id, [group.first.group.id, result.newGroupId]),
      );
    expect(persistedGroups).toEqual(
      expect.arrayContaining([
        {
          id: group.first.group.id,
          representativeBottleId: third!.bottle.id,
        },
        {
          id: result.newGroupId,
          representativeBottleId: second!.bottle.id,
        },
      ]),
    );
    expect(
      (
        await db
          .select()
          .from(changes)
          .where(inArray(changes.objectId, movedBottleIds))
      ).filter(
        ({ data, objectType }) =>
          objectType === "bottle" && data.updateScope === "group_split",
      ),
    ).toHaveLength(2);
  });

  test("rejects missing, retired, foreign, all-member, and representative conflicts without writes", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const source = await createGroup({ user: mod, fixtures });
    const foreign = await createGroup({ user: mod, fixtures, count: 1 });
    const sourceGroupId = source.first.group.id;
    const firstId = source.members[0]!.bottle.id;
    const secondId = source.members[1]!.bottle.id;
    const thirdId = source.members[2]!.bottle.id;

    const cases: Array<{
      input: Record<string, unknown>;
      expected: Partial<
        BottleGroupSplitGraphError | BottleGroupSplitConflictError
      >;
    }> = [
      {
        input: {
          movedBottleIds: [999_999],
          newRepresentativeBottleId: 999_999,
        },
        expected: { code: "moved_bottle_not_found", bottleId: 999_999 },
      },
      {
        input: {
          movedBottleIds: [foreign.first.bottle.id],
          newRepresentativeBottleId: foreign.first.bottle.id,
        },
        expected: {
          code: "moved_bottle_not_member",
          bottleId: foreign.first.bottle.id,
        },
      },
      {
        input: {
          movedBottleIds: [firstId, secondId, thirdId],
          newRepresentativeBottleId: firstId,
        },
        expected: { code: "all_members_selected" },
      },
      {
        input: {
          movedBottleIds: [secondId],
          newRepresentativeBottleId: thirdId,
        },
        expected: { code: "new_representative_not_selected" },
      },
      {
        input: {
          movedBottleIds: [secondId],
          newRepresentativeBottleId: secondId,
          sourceRepresentativeBottleId: thirdId,
        },
        expected: { code: "source_representative_mismatch" },
      },
      {
        input: {
          movedBottleIds: [firstId],
          newRepresentativeBottleId: firstId,
          sourceRepresentativeBottleId: firstId,
        },
        expected: { code: "source_representative_not_survivor" },
      },
    ];
    for (const attempt of cases) {
      const before = await auditCounts();
      expect(
        await waitError(
          splitBottleGroup({
            sourceGroupId,
            input: attempt.input,
            context: contextFor(mod),
          }),
        ),
      ).toMatchObject(attempt.expected);
      expect(await auditCounts()).toEqual(before);
    }

    await db.insert(bottleTombstones).values({ bottleId: secondId });
    const beforeRetired = await auditCounts();
    expect(
      await waitError(
        splitBottleGroup({
          sourceGroupId,
          input: {
            movedBottleIds: [secondId],
            newRepresentativeBottleId: secondId,
          },
          context: contextFor(mod),
        }),
      ),
    ).toMatchObject({ code: "moved_bottle_retired", bottleId: secondId });
    expect(await auditCounts()).toEqual(beforeRetired);
  });

  test("rejects malformed source target or distiller graphs before writing split state", async ({
    fixtures,
  }) => {
    for (const malformation of ["target", "distiller"] as const) {
      const mod = await fixtures.User({ mod: true });
      const source = await createGroup({ user: mod, fixtures });
      const sourceGroupId = source.first.group.id;
      const movedId = source.members[1]!.bottle.id;
      if (malformation === "target") {
        const [target] = await db
          .select()
          .from(catalogTargets)
          .where(eq(catalogTargets.bottleId, movedId));
        await db
          .delete(bottleAliases)
          .where(eq(bottleAliases.targetId, target!.id));
        await db
          .delete(catalogTargets)
          .where(eq(catalogTargets.id, target!.id));
      } else {
        await db
          .delete(bottlesToDistillers)
          .where(eq(bottlesToDistillers.bottleId, movedId));
      }
      const before = await auditCounts();
      const membersBefore = await db
        .select()
        .from(bottles)
        .where(eq(bottles.groupId, sourceGroupId))
        .orderBy(asc(bottles.id));

      const error = await waitError(
        splitBottleGroup({
          sourceGroupId,
          input: {
            movedBottleIds: [movedId],
            newRepresentativeBottleId: movedId,
          },
          context: contextFor(mod),
        }),
      );
      expect(error).toBeInstanceOf(BottleGroupSplitGraphError);
      expect(error).toMatchObject({ code: "invalid_catalog_graph" });
      expect(await auditCounts()).toEqual(before);
      expect(
        await db
          .select()
          .from(bottles)
          .where(
            inArray(
              bottles.id,
              membersBefore.map(({ id }) => id),
            ),
          )
          .orderBy(asc(bottles.id)),
      ).toEqual(membersBefore);
    }
  });
});
