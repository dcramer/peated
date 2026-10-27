import { db } from "@peated/server/db";
import { bottles, changes } from "@peated/server/db/schema";
import { activeBottleWhere } from "@peated/server/lib/activeBottles";
import { getPeatedSystemActorForDatabase } from "@peated/server/lib/actors";
import { SystemBottlePatchSchema } from "@peated/server/lib/bottleSchemas";
import {
  BottleUpdateExpectedBottleStateError,
  bottleUpdateExpectedSelectedBottleState,
  BottleUpdateGraphError,
  finalizeBottleUpdate,
  updateBottleInTransaction,
} from "@peated/server/lib/updateBottle";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, asc, count, eq, gt, isNotNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/clear-bottle-descriptions",
    summary: "Clear generated Bottle descriptions",
    description:
      "Clear Bottle descriptions that a model wrote from memory. Descriptions a person wrote, and descriptions with no recorded writer, are kept. Use `dryRun` to list what would be cleared without changing anything. Continue with `nextAfterId` until it is null. Requires administrator privileges.",
    operationId: "clearBottleDescriptions",
  })
  .input(
    z
      .object({
        afterId: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe("Check Bottles with IDs greater than this value"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(100)
          .describe("Number of Bottles to check"),
        dryRun: z
          .boolean()
          .default(false)
          .describe("List the Bottles that would be cleared, but change none"),
      })
      .strict(),
  )
  .output(
    z.object({
      bottleIds: z
        .array(z.number())
        .describe("Bottles cleared, or that would be cleared in a dry run"),
      checked: z.number(),
      remaining: z
        .number()
        .describe("Generated descriptions after `afterId`, before this call"),
      nextAfterId: z.number().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    // Description rule (owner: docs/features/bottle-presentation.md): only
    // descriptions marked as generated are cleared. A null source may be
    // text a person wrote before Peated recorded who wrote descriptions.
    const where = and(
      gt(bottles.id, input.afterId),
      activeBottleWhere(),
      eq(bottles.descriptionSrc, "generated"),
      isNotNull(bottles.description),
    );
    const [rows, [{ remaining }]] = await Promise.all([
      db
        .select()
        .from(bottles)
        .where(where)
        .orderBy(asc(bottles.id))
        .limit(input.limit + 1),
      db.select({ remaining: count() }).from(bottles).where(where),
    ]);
    const page = rows.slice(0, input.limit);
    const nextAfterId = rows.length > input.limit ? page.at(-1)!.id : null;

    if (input.dryRun) {
      return {
        bottleIds: page.map(({ id }) => id),
        checked: page.length,
        remaining,
        nextAfterId,
      };
    }

    const patch = SystemBottlePatchSchema.parse({
      description: null,
      descriptionSrc: null,
    });
    const bottleIds: number[] = [];
    for (const bottle of page) {
      let update;
      try {
        update = await db.transaction(async (tx) => {
          const actor = await getPeatedSystemActorForDatabase(tx);
          const result = await updateBottleInTransaction(tx, {
            bottleId: bottle.id,
            input: patch,
            // An edit since the page read may have replaced the description.
            expectedSelectedBottleState:
              bottleUpdateExpectedSelectedBottleState(bottle),
            actorId: actor.id,
            creationSource: "repair_workflow",
            recordChange: false,
          });
          if (!result.changed) return result;
          // History rule (owner: docs/features/bottle-presentation.md): the
          // old generated text was saved without a change, so this change
          // keeps it in `before`, or a clear could not be undone.
          await tx.insert(changes).values({
            objectType: "bottle",
            objectId: bottle.id,
            actorId: actor.id,
            displayName: result.bottle.fullName,
            type: "update",
            data: {
              description: null,
              descriptionSrc: null,
              before: {
                description: bottle.description,
                descriptionSrc: bottle.descriptionSrc,
              },
              updateScope: "exact",
              creationSource: "repair_workflow",
              groupId: result.group.id,
              requestedBottleId: bottle.id,
            },
          });
          return result;
        });
      } catch (error) {
        // A Bottle edited, merged, or retired since the page read is no
        // longer this page's to clear; the next run sees its current state.
        if (
          error instanceof BottleUpdateExpectedBottleStateError ||
          (error instanceof BottleUpdateGraphError &&
            (error.code === "not_found" || error.code === "retired"))
        ) {
          continue;
        }
        throw error;
      }
      if (!update.changed) continue;
      await finalizeBottleUpdate(update);
      bottleIds.push(bottle.id);
    }

    return {
      bottleIds,
      checked: page.length,
      remaining,
      nextAfterId,
    };
  });
