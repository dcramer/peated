import { db } from "@peated/server/db";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    alias: z.string(),
    ignored: z.boolean().optional(),
  })
  .strict();

const OutputSchema = z.object({
  name: z.string(),
  createdAt: z.string(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-aliases/{alias}",
    summary: "Update bottle alias",
    description:
      "Update bottle alias properties such as ignored status. Requires moderator privileges",
    operationId: "updateBottleAlias",
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input, errors }) {
    const { alias: aliasName, ...data } = input;

    const updateResult = await db.transaction(async (tx) => {
      const [alias] = await tx
        .select()
        .from(bottleAliases)
        .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()))
        .limit(1);

      if (!alias) {
        throw errors.NOT_FOUND({
          message: "Alias not found.",
        });
      }
      if (data.ignored === true && alias.bottleId !== null) {
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
            message: "Cannot ignore canonical name",
          });
        }
      }

      if (Object.values(data).length === 0) {
        return {
          result: {
            name: alias.name,
            createdAt: alias.createdAt.toISOString(),
          },
          changed: false,
          bottleId: alias.bottleId,
        };
      }

      const [updatedAlias] = await tx
        .update(bottleAliases)
        .set(data)
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
        .returning();

      if (!updatedAlias) {
        throw errors.CONFLICT({
          message:
            "Bottle Alias changed while it was being updated. Retry the operation.",
        });
      }

      return {
        result: {
          name: updatedAlias.name,
          createdAt: updatedAlias.createdAt.toISOString(),
        },
        changed: true,
        bottleId: updatedAlias.bottleId,
      };
    });

    if (updateResult.changed) {
      try {
        await pushJob("IndexBottleAlias", { name: updateResult.result.name });
      } catch (error) {
        logError(error, {
          bottleAlias: { name: updateResult.result.name },
        });
      }

      if (updateResult.bottleId !== null) {
        try {
          await pushUniqueJob("IndexBottleSearchVectors", {
            bottleId: updateResult.bottleId,
          });
        } catch (error) {
          logError(error, {
            bottleAlias: { name: updateResult.result.name },
            bottle: { id: updateResult.bottleId },
          });
        }
      }
    }

    return updateResult.result;
  });
