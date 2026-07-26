import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/bottle-aliases/{alias}",
    summary: "Delete bottle alias",
    description:
      "Unassign one Bottle alias and clear matching direct Bottle references. Cannot delete canonical names. Requires moderator privileges",
    operationId: "deleteBottleAlias",
  })
  .input(z.object({ alias: z.string() }).strict())
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    const { aliasName, bottleId } = await db.transaction(async (tx) => {
      const [alias] = await tx
        .select()
        .from(bottleAliases)
        .where(eq(sql`LOWER(${bottleAliases.name})`, input.alias.toLowerCase()))
        .limit(1);

      if (!alias) {
        throw errors.NOT_FOUND({
          message: "Bottle Alias not found.",
        });
      }
      if (alias.bottleId === null) {
        throw errors.CONFLICT({
          message: "Bottle Alias is not assigned to a Bottle.",
        });
      }
      const aliasBottleId = alias.bottleId;

      const [bottle] = await tx
        .select()
        .from(bottles)
        .where(eq(bottles.id, aliasBottleId))
        .limit(1)
        .for("update");
      if (!bottle) {
        throw errors.CONFLICT({
          message: "Bottle Alias points to a missing Bottle.",
        });
      }
      if (alias.name.toLowerCase() === bottle.fullName.toLowerCase()) {
        throw errors.BAD_REQUEST({
          message: "Cannot delete canonical name",
        });
      }

      await tx
        .update(storePrices)
        .set({ bottleId: null })
        .where(
          and(
            eq(sql`LOWER(${storePrices.name})`, alias.name.toLowerCase()),
            eq(storePrices.bottleId, bottle.id),
          ),
        );
      await tx
        .update(reviews)
        .set({ bottleId: null })
        .where(
          and(
            eq(sql`LOWER(${reviews.name})`, alias.name.toLowerCase()),
            eq(reviews.bottleId, bottle.id),
          ),
        );

      // A concurrent alias retarget must roll back the earlier consumer clears.
      const [clearedAlias] = await tx
        .update(bottleAliases)
        .set({ bottleId: null })
        .where(
          and(
            eq(bottleAliases.name, alias.name),
            sql`${bottleAliases.bottleId} IS NOT DISTINCT FROM ${alias.bottleId}`,
            sql`${bottleAliases.releaseId} IS NOT DISTINCT FROM ${alias.releaseId}`,
            sql`${bottleAliases.targetId} IS NOT DISTINCT FROM ${alias.targetId}`,
            sql`${bottleAliases.ignored} IS NOT DISTINCT FROM ${alias.ignored}`,
            eq(bottleAliases.assignmentSource, alias.assignmentSource),
            eq(bottleAliases.assignedByActorId, alias.assignedByActorId),
            eq(bottleAliases.createdAt, alias.createdAt),
          ),
        )
        .returning({ name: bottleAliases.name });
      if (!clearedAlias) {
        throw errors.CONFLICT({
          message:
            "Bottle Alias changed while it was being unassigned. Retry the operation.",
        });
      }

      return { aliasName: alias.name, bottleId: bottle.id };
    });

    try {
      await pushJob("IndexBottleAlias", { name: aliasName });
    } catch (error) {
      logError(error, {
        contexts: {
          bottle: { id: bottleId },
          bottleAlias: { name: input.alias },
        },
        extra: {
          operation: "deleteBottleAlias",
          job: "IndexBottleAlias",
        },
      });
    }

    try {
      await pushJob("IndexBottleSearchVectors", { bottleId });
    } catch (error) {
      logError(error, {
        contexts: {
          bottle: { id: bottleId },
          bottleAlias: { name: input.alias },
        },
        extra: {
          operation: "deleteBottleAlias",
          job: "IndexBottleSearchVectors",
        },
      });
    }

    return {};
  });
