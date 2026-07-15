/**
 * Owns moderator-directed BottleGroup splits. Selected Bottles retain their
 * complete exact identity and exact targets while ambiguous generic activity
 * stays with the source group.
 */
import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle, BottleGroup, User } from "@peated/server/db/schema";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  catalogTargets,
  changes,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { recomputeBottleGroupStatsInTransaction } from "@peated/server/lib/recomputeBottleGroupStats";
import type { Context } from "@peated/server/orpc/context";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

export const BottleGroupSplitInputSchema = z
  .object({
    movedBottleIds: z.array(z.number().int().positive()).nonempty(),
    newRepresentativeBottleId: z.number().int().positive(),
    sourceRepresentativeBottleId: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine(({ movedBottleIds }, ctx) => {
    if (new Set(movedBottleIds).size !== movedBottleIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Moved Bottle IDs must be unique.",
        path: ["movedBottleIds"],
      });
    }
  });

export type BottleGroupSplitInput = z.infer<typeof BottleGroupSplitInputSchema>;

export class BottleGroupSplitAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to split BottleGroups.");
    this.name = "BottleGroupSplitAuthorizationError";
  }
}

export class BottleGroupSplitInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleGroupSplitInputError";
  }
}

export type BottleGroupSplitGraphErrorCode =
  | "not_found"
  | "retired"
  | "moved_bottle_not_found"
  | "moved_bottle_retired"
  | "moved_bottle_not_member"
  | "invalid_catalog_graph";

export class BottleGroupSplitGraphError extends Error {
  constructor(
    readonly code: BottleGroupSplitGraphErrorCode,
    readonly groupId: number,
    readonly bottleId: number | null = null,
  ) {
    super(
      `Cannot split BottleGroup ${groupId}: ${code}${
        bottleId === null ? "" : ` (Bottle ${bottleId})`
      }.`,
    );
    this.name = "BottleGroupSplitGraphError";
  }
}

export type BottleGroupSplitConflictCode =
  | "all_members_selected"
  | "new_representative_not_selected"
  | "source_representative_required"
  | "source_representative_not_survivor"
  | "source_representative_mismatch";

export class BottleGroupSplitConflictError extends Error {
  constructor(readonly code: BottleGroupSplitConflictCode) {
    super(`BottleGroup split failed: ${code}.`);
    this.name = "BottleGroupSplitConflictError";
  }
}

export type BottleGroupSplitResult = {
  sourceGroupId: number;
  newGroupId: number;
  movedBottleIds: number[];
  sourceRepresentativeBottleId: number;
  newRepresentativeBottleId: number;
};

function bottleSnapshot(
  bottle: Bottle,
  distillerIds: number[],
  targetId: number,
) {
  return { ...bottle, distillerIds, targetId };
}

function groupSnapshot(
  group: BottleGroup,
  distillerIds: number[],
  genericTarget: {
    id: number;
    groupId: number;
    bottleId: number | null;
    createdAt: Date;
  },
) {
  return { ...group, distillerIds, genericTarget };
}

function sameIds(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/**
 * Locks and validates the source graph, then atomically commits membership,
 * representatives, target cascades, group stats, and audits while leaving
 * exact Bottle content and generic source state unchanged. Group-owned
 * editorial stays with the source group, and the new group starts empty.
 */
async function splitBottleGroupInTransaction(
  tx: AnyTransaction,
  {
    sourceGroupId,
    input,
    user,
  }: {
    sourceGroupId: number;
    input: BottleGroupSplitInput;
    user: User;
  },
): Promise<BottleGroupSplitResult> {
  const [sourceGroup] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, sourceGroupId))
    .limit(1)
    .for("update");
  const [groupTombstone] = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, sourceGroupId))
    .limit(1)
    .for("update");
  if (groupTombstone) {
    throw new BottleGroupSplitGraphError("retired", sourceGroupId);
  }
  if (!sourceGroup) {
    throw new BottleGroupSplitGraphError("not_found", sourceGroupId);
  }

  const sourceMembers = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.groupId, sourceGroupId))
    .orderBy(asc(bottles.id))
    .for("update");
  if (!sourceMembers.length || sourceGroup.representativeBottleId === null) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }

  const sourceMemberIds = sourceMembers.map(({ id }) => id);
  const requestedBottleIds = [...input.movedBottleIds].sort(
    (left, right) => left - right,
  );
  const requestedBottles = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(inArray(bottles.id, requestedBottleIds))
    .orderBy(asc(bottles.id))
    .for("update");
  const retiredRequested = await tx
    .select({ bottleId: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, requestedBottleIds))
    .orderBy(asc(bottleTombstones.bottleId))
    .for("update");
  const retiredRequestedIds = new Set(
    retiredRequested.map(({ bottleId }) => bottleId),
  );
  const requestedById = new Map(
    requestedBottles.map((bottle) => [bottle.id, bottle]),
  );
  for (const bottleId of requestedBottleIds) {
    if (retiredRequestedIds.has(bottleId)) {
      throw new BottleGroupSplitGraphError(
        "moved_bottle_retired",
        sourceGroupId,
        bottleId,
      );
    }
    const bottle = requestedById.get(bottleId);
    if (!bottle) {
      throw new BottleGroupSplitGraphError(
        "moved_bottle_not_found",
        sourceGroupId,
        bottleId,
      );
    }
    if (bottle.groupId !== sourceGroupId) {
      throw new BottleGroupSplitGraphError(
        "moved_bottle_not_member",
        sourceGroupId,
        bottleId,
      );
    }
  }

  const retiredMembers = await tx
    .select({ bottleId: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, sourceMemberIds));
  if (retiredMembers.length) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
      retiredMembers[0]!.bottleId,
    );
  }
  if (!sourceMemberIds.includes(sourceGroup.representativeBottleId)) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
      sourceGroup.representativeBottleId,
    );
  }
  if (requestedBottleIds.length === sourceMembers.length) {
    throw new BottleGroupSplitConflictError("all_members_selected");
  }
  if (!requestedBottleIds.includes(input.newRepresentativeBottleId)) {
    throw new BottleGroupSplitConflictError("new_representative_not_selected");
  }

  const movedIds = new Set(requestedBottleIds);
  const survivingIds = sourceMemberIds.filter((id) => !movedIds.has(id));
  const currentRepresentativeMoves = movedIds.has(
    sourceGroup.representativeBottleId,
  );
  let sourceRepresentativeBottleId: number;
  if (currentRepresentativeMoves) {
    if (input.sourceRepresentativeBottleId === undefined) {
      throw new BottleGroupSplitConflictError("source_representative_required");
    }
    if (!survivingIds.includes(input.sourceRepresentativeBottleId)) {
      throw new BottleGroupSplitConflictError(
        "source_representative_not_survivor",
      );
    }
    sourceRepresentativeBottleId = input.sourceRepresentativeBottleId;
  } else {
    if (
      input.sourceRepresentativeBottleId !== undefined &&
      input.sourceRepresentativeBottleId !== sourceGroup.representativeBottleId
    ) {
      throw new BottleGroupSplitConflictError("source_representative_mismatch");
    }
    sourceRepresentativeBottleId = sourceGroup.representativeBottleId;
  }

  const sourceTargets = await tx
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, sourceGroupId))
    .orderBy(asc(catalogTargets.id))
    .for("update");
  const sourceGenericTargets = sourceTargets.filter(
    ({ bottleId }) => bottleId === null,
  );
  const exactTargetByBottleId = new Map(
    sourceTargets.flatMap((target) =>
      target.bottleId === null ? [] : [[target.bottleId, target] as const],
    ),
  );
  if (
    sourceGenericTargets.length !== 1 ||
    sourceTargets.length !== sourceMembers.length + 1 ||
    sourceMembers.some(({ id }) => !exactTargetByBottleId.has(id)) ||
    sourceTargets.some(
      ({ bottleId }) =>
        bottleId !== null && !sourceMemberIds.includes(bottleId),
    )
  ) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }
  const sourceGenericTarget = sourceGenericTargets[0]!;

  const groupDistillers = await tx
    .select()
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, sourceGroupId))
    .orderBy(asc(bottleGroupDistillers.distillerId))
    .for("share");
  const distillerIds = groupDistillers.map(({ distillerId }) => distillerId);
  const bottleDistillers = await tx
    .select()
    .from(bottlesToDistillers)
    .where(inArray(bottlesToDistillers.bottleId, sourceMemberIds))
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    )
    .for("share");
  const distillersByBottleId = new Map<number, number[]>();
  for (const row of bottleDistillers) {
    const memberDistillers = distillersByBottleId.get(row.bottleId) ?? [];
    memberDistillers.push(row.distillerId);
    distillersByBottleId.set(row.bottleId, memberDistillers);
  }
  if (
    sourceMembers.some(
      ({ id }) => !sameIds(distillersByBottleId.get(id) ?? [], distillerIds),
    )
  ) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }

  const actor = await getUserActorForDatabase(tx, user);
  const [newGroup] = await tx
    .insert(bottleGroups)
    .values({
      fullName: sourceGroup.fullName,
      name: sourceGroup.name,
      statedAge: sourceGroup.statedAge,
      seriesId: sourceGroup.seriesId,
      category: sourceGroup.category,
      brandId: sourceGroup.brandId,
      bottlerId: sourceGroup.bottlerId,
      flavorProfile: sourceGroup.flavorProfile,
      representativeBottleId: null,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      tastingNotes: null,
      suggestedTags: [],
      avgRating: null,
      totalTastings: 0,
      totalBottles: 0,
      createdByActorId: actor.id,
    })
    .returning();
  if (!newGroup) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }
  if (distillerIds.length) {
    await tx.insert(bottleGroupDistillers).values(
      distillerIds.map((distillerId) => ({
        groupId: newGroup.id,
        distillerId,
      })),
    );
  }
  const [newGenericTarget] = await tx
    .insert(catalogTargets)
    .values({ groupId: newGroup.id })
    .returning();
  if (!newGenericTarget) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }

  const movedAt = new Date();
  // Clear, move, then restore representatives to satisfy the membership FK.
  await tx
    .update(bottleGroups)
    .set({ representativeBottleId: null })
    .where(eq(bottleGroups.id, sourceGroupId));
  const movedBottles = await tx
    .update(bottles)
    .set({ groupId: newGroup.id, updatedAt: movedAt })
    .where(inArray(bottles.id, requestedBottleIds))
    .returning();
  if (movedBottles.length !== requestedBottleIds.length) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }
  await tx
    .update(bottleGroups)
    .set({ representativeBottleId: sourceRepresentativeBottleId })
    .where(eq(bottleGroups.id, sourceGroupId));
  await tx
    .update(bottleGroups)
    .set({ representativeBottleId: input.newRepresentativeBottleId })
    .where(eq(bottleGroups.id, newGroup.id));

  await recomputeBottleGroupStatsInTransaction(tx, sourceGroupId);
  await recomputeBottleGroupStatsInTransaction(tx, newGroup.id);
  const [persistedSourceGroup] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, sourceGroupId))
    .limit(1);
  const [persistedNewGroup] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, newGroup.id))
    .limit(1);
  if (!persistedSourceGroup || !persistedNewGroup) {
    throw new BottleGroupSplitGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }

  const movedBottleById = new Map(
    movedBottles.map((bottle) => [bottle.id, bottle]),
  );
  const sourceBottleById = new Map(
    sourceMembers.map((bottle) => [bottle.id, bottle]),
  );
  for (const bottleId of requestedBottleIds) {
    const before = sourceBottleById.get(bottleId)!;
    const after = movedBottleById.get(bottleId);
    if (!after) {
      throw new BottleGroupSplitGraphError(
        "invalid_catalog_graph",
        sourceGroupId,
        bottleId,
      );
    }
    const targetId = exactTargetByBottleId.get(bottleId)!.id;
    await tx.insert(changes).values({
      objectType: "bottle",
      objectId: bottleId,
      actorId: actor.id,
      displayName: after.fullName,
      type: "update",
      data: {
        updateScope: "group_split",
        sourceGroupId,
        newGroupId: newGroup.id,
        before: bottleSnapshot(before, distillerIds, targetId),
        after: bottleSnapshot(after, distillerIds, targetId),
      },
    });
  }

  await tx.insert(changes).values({
    objectType: "bottle_group",
    objectId: sourceGroupId,
    actorId: actor.id,
    displayName: sourceGroup.fullName,
    type: "update",
    data: {
      updateScope: "group_split",
      sourceGroupId,
      newGroupId: newGroup.id,
      movedBottleIds: requestedBottleIds,
      before: groupSnapshot(sourceGroup, distillerIds, sourceGenericTarget),
      after: groupSnapshot(
        persistedSourceGroup,
        distillerIds,
        sourceGenericTarget,
      ),
    },
  });
  await tx.insert(changes).values({
    objectType: "bottle_group",
    objectId: newGroup.id,
    actorId: actor.id,
    displayName: persistedNewGroup.fullName,
    type: "add",
    data: {
      updateScope: "group_split",
      sourceGroupId,
      newGroupId: newGroup.id,
      movedBottleIds: requestedBottleIds,
      after: groupSnapshot(persistedNewGroup, distillerIds, newGenericTarget),
    },
  });

  return {
    sourceGroupId,
    newGroupId: newGroup.id,
    movedBottleIds: requestedBottleIds,
    sourceRepresentativeBottleId,
    newRepresentativeBottleId: input.newRepresentativeBottleId,
  };
}

/** Parses, authorizes, and atomically splits selected BottleGroup members. */
export async function splitBottleGroup({
  sourceGroupId,
  input: rawInput,
  context,
}: {
  sourceGroupId: number;
  input: unknown;
  context: Context;
}): Promise<BottleGroupSplitResult> {
  if (!context.user?.admin && !context.user?.mod) {
    throw new BottleGroupSplitAuthorizationError();
  }
  if (!Number.isInteger(sourceGroupId) || sourceGroupId <= 0) {
    throw new BottleGroupSplitInputError(
      "Source BottleGroup ID must be a positive integer.",
    );
  }
  const input = BottleGroupSplitInputSchema.parse(rawInput);
  const user: User = context.user;
  return await db.transaction((tx) =>
    splitBottleGroupInTransaction(tx, { sourceGroupId, input, user }),
  );
}
