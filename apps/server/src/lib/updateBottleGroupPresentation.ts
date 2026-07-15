/**
 * Owns moderator BottleGroup presentation persistence and audit without ever
 * rewriting member Bottles.
 */
import { isDeepStrictEqual } from "node:util";

import { db, type AnyTransaction } from "@peated/server/db";
import type { BottleGroup, User } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  changes,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import type { Context } from "@peated/server/orpc/context";
import { eq } from "drizzle-orm";
import { z } from "zod";

const TastingNotesSchema = z
  .object({
    nose: z.string(),
    palate: z.string(),
    finish: z.string(),
  })
  .strict();

export const BottleGroupPresentationPatchSchema = z
  .object({
    representativeBottleId: z.number().int().positive().optional(),
    description: z.string().nullable().optional(),
    descriptionSrc: z.enum(["generated", "user"]).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    tastingNotes: TastingNotesSchema.nullable().optional(),
  })
  .strict();

export type BottleGroupPresentationPatch = z.infer<
  typeof BottleGroupPresentationPatchSchema
>;

export class BottleGroupPresentationAuthorizationError extends Error {
  constructor() {
    super(
      "Moderator authorization is required to update BottleGroup presentation.",
    );
    this.name = "BottleGroupPresentationAuthorizationError";
  }
}

export class BottleGroupPresentationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleGroupPresentationInputError";
  }
}

export type BottleGroupPresentationGraphErrorCode =
  | "not_found"
  | "retired"
  | "representative_not_found"
  | "representative_retired"
  | "representative_not_member"
  | "invalid_catalog_graph";

export class BottleGroupPresentationGraphError extends Error {
  constructor(
    readonly code: BottleGroupPresentationGraphErrorCode,
    readonly groupId: number,
    readonly bottleId: number | null = null,
  ) {
    super(
      `Cannot update BottleGroup ${groupId} presentation: ${code}${
        bottleId === null ? "" : ` (Bottle ${bottleId})`
      }.`,
    );
    this.name = "BottleGroupPresentationGraphError";
  }
}

export type BottleGroupPresentationUpdateResult = {
  group: BottleGroup;
  changed: boolean;
};

type PresentationSnapshot = Pick<
  BottleGroup,
  | "representativeBottleId"
  | "description"
  | "descriptionSrc"
  | "imageUrl"
  | "tastingNotes"
  | "updatedAt"
>;

function presentationSnapshot(group: BottleGroup): PresentationSnapshot {
  return {
    representativeBottleId: group.representativeBottleId,
    description: group.description,
    descriptionSrc: group.descriptionSrc,
    imageUrl: group.imageUrl,
    tastingNotes: group.tastingNotes,
    updatedAt: group.updatedAt,
  };
}

async function groupRetired(tx: AnyTransaction, groupId: number) {
  const [tombstone] = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, groupId))
    .limit(1);
  return tombstone !== undefined;
}

async function bottleRetired(tx: AnyTransaction, bottleId: number) {
  const [tombstone] = await tx
    .select({ bottleId: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottleId))
    .limit(1);
  return tombstone !== undefined;
}

async function validateCurrentRepresentative(
  tx: AnyTransaction,
  group: BottleGroup,
) {
  if (group.representativeBottleId === null) return;

  const [representative] = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, group.representativeBottleId))
    .limit(1)
    .for("update");
  if (
    !representative ||
    representative.groupId !== group.id ||
    (await bottleRetired(tx, group.representativeBottleId))
  ) {
    throw new BottleGroupPresentationGraphError(
      "invalid_catalog_graph",
      group.id,
      group.representativeBottleId,
    );
  }
}

async function validateRequestedRepresentative(
  tx: AnyTransaction,
  groupId: number,
  representativeBottleId: number,
) {
  const [representative] = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, representativeBottleId))
    .limit(1)
    .for("update");
  const retired = await bottleRetired(tx, representativeBottleId);
  if (retired) {
    throw new BottleGroupPresentationGraphError(
      "representative_retired",
      groupId,
      representativeBottleId,
    );
  }
  if (!representative) {
    throw new BottleGroupPresentationGraphError(
      "representative_not_found",
      groupId,
      representativeBottleId,
    );
  }
  if (representative.groupId !== groupId) {
    throw new BottleGroupPresentationGraphError(
      "representative_not_member",
      groupId,
      representativeBottleId,
    );
  }
}

function desiredPresentation(
  group: BottleGroup,
  patch: BottleGroupPresentationPatch,
): Omit<PresentationSnapshot, "updatedAt"> {
  const description =
    patch.description === undefined ? group.description : patch.description;
  const descriptionSrc =
    patch.descriptionSrc !== undefined
      ? patch.descriptionSrc
      : patch.description !== undefined
        ? description === null
          ? null
          : "user"
        : group.descriptionSrc;

  return {
    representativeBottleId:
      patch.representativeBottleId ?? group.representativeBottleId,
    description,
    descriptionSrc,
    imageUrl: patch.imageUrl === undefined ? group.imageUrl : patch.imageUrl,
    tastingNotes:
      patch.tastingNotes === undefined
        ? group.tastingNotes
        : patch.tastingNotes,
  };
}

/**
 * Atomically persists a group presentation update and its single audit while
 * leaving member Bottles unchanged.
 */
async function updateBottleGroupPresentationInTransaction(
  tx: AnyTransaction,
  {
    groupId,
    patch,
    user,
  }: {
    groupId: number;
    patch: BottleGroupPresentationPatch;
    user: User;
  },
): Promise<BottleGroupPresentationUpdateResult> {
  const [group] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId))
    .limit(1)
    .for("update");

  if (!group) {
    throw new BottleGroupPresentationGraphError(
      (await groupRetired(tx, groupId)) ? "retired" : "not_found",
      groupId,
    );
  }
  if (await groupRetired(tx, groupId)) {
    throw new BottleGroupPresentationGraphError("retired", groupId);
  }

  await validateCurrentRepresentative(tx, group);
  if (
    patch.representativeBottleId !== undefined &&
    patch.representativeBottleId !== group.representativeBottleId
  ) {
    await validateRequestedRepresentative(
      tx,
      groupId,
      patch.representativeBottleId,
    );
  }

  const desired = desiredPresentation(group, patch);
  const before = presentationSnapshot(group);
  if (
    desired.representativeBottleId === before.representativeBottleId &&
    desired.description === before.description &&
    desired.descriptionSrc === before.descriptionSrc &&
    desired.imageUrl === before.imageUrl &&
    isDeepStrictEqual(desired.tastingNotes, before.tastingNotes)
  ) {
    return { group, changed: false };
  }

  const actor = await getUserActorForDatabase(tx, user);
  const [persistedGroup] = await tx
    .update(bottleGroups)
    .set({ ...desired, updatedAt: new Date() })
    .where(eq(bottleGroups.id, groupId))
    .returning();
  if (!persistedGroup) {
    throw new BottleGroupPresentationGraphError(
      "invalid_catalog_graph",
      groupId,
    );
  }

  await tx.insert(changes).values({
    objectType: "bottle_group",
    objectId: groupId,
    actorId: actor.id,
    displayName: persistedGroup.fullName,
    type: "update",
    data: {
      updateScope: "group_presentation",
      before,
      after: presentationSnapshot(persistedGroup),
    },
  });

  return { group: persistedGroup, changed: true };
}

/** Parses, authorizes, and atomically updates BottleGroup-owned presentation. */
export async function updateBottleGroupPresentation({
  groupId,
  input: rawInput,
  context,
}: {
  groupId: number;
  input: unknown;
  context: Context;
}): Promise<BottleGroupPresentationUpdateResult> {
  if (!context.user?.admin && !context.user?.mod) {
    throw new BottleGroupPresentationAuthorizationError();
  }
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new BottleGroupPresentationInputError(
      "BottleGroup ID must be a positive integer.",
    );
  }
  const patch = BottleGroupPresentationPatchSchema.parse(rawInput);
  const user: User = context.user;

  return await db.transaction((tx) =>
    updateBottleGroupPresentationInTransaction(tx, { groupId, patch, user }),
  );
}
