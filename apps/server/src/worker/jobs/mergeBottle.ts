/**
 * Compatibility adapter for queued MergeBottle payloads created before the
 * synchronous route cutover. Remove with the remaining legacy workers in 9.7.
 */
import { db } from "@peated/server/db";
import {
  getPeatedSystemActorForDatabase,
  getUserActorByIdForDatabase,
} from "@peated/server/lib/actors";
import { logInfo } from "@peated/server/lib/log";
import {
  finalizeConcreteBottleMerge,
  mergeConcreteBottlesInTransaction,
  type ConcreteBottleMergeFinalizationManifest,
} from "@peated/server/lib/mergeConcreteBottles";
import type { JobContext } from "@peated/server/worker/types";
import { z } from "zod";

const MergeBottleJobArgsSchema = z
  .object({
    toBottleId: z.number().int().positive(),
    fromBottleIds: z.array(z.number().int().positive()).nonempty(),
  })
  .strict()
  .superRefine(({ toBottleId, fromBottleIds }, context) => {
    if (new Set(fromBottleIds).size !== fromBottleIds.length) {
      context.addIssue({
        code: "custom",
        path: ["fromBottleIds"],
        message: "Source Bottle IDs must be distinct.",
      });
    }
    if (fromBottleIds.includes(toBottleId)) {
      context.addIssue({
        code: "custom",
        path: ["fromBottleIds"],
        message: "The destination Bottle cannot also be a source.",
      });
    }
  });

export default async function mergeBottle(
  input: unknown,
  context: JobContext = {},
) {
  const args = MergeBottleJobArgsSchema.parse(input);
  logInfo("Legacy MergeBottle compatibility write", {
    extra: {
      event: "bottle_merge.compatibility",
      access: "write",
      caller: "worker.jobs.mergeBottle",
      operation: "merge_concrete_bottles",
      toBottleId: args.toBottleId,
      fromBottleIds: args.fromBottleIds,
    },
  });

  const manifests: ConcreteBottleMergeFinalizationManifest[] = [];
  await db.transaction(async (tx) => {
    const actor = context.actor
      ? await getUserActorByIdForDatabase(tx, context.actor.userId)
      : await getPeatedSystemActorForDatabase(tx);
    for (const sourceBottleId of args.fromBottleIds) {
      manifests.push(
        await mergeConcreteBottlesInTransaction(tx, {
          sourceBottleId,
          destinationBottleId: args.toBottleId,
          actorId: actor.id,
        }),
      );
    }
  });

  for (const manifest of manifests) {
    await finalizeConcreteBottleMerge(manifest);
  }
}
