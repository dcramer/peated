import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetResolutionError,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "DELETE",
    path: "/bottle-aliases/{alias}",
    summary: "Delete bottle alias",
    description:
      "Remove bottle alias association and clear related references. Cannot delete canonical names. Requires moderator privileges",
    operationId: "deleteBottleAlias",
  })
  .use(requireMod)
  .input(z.object({ alias: z.string() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    let bottleIdsToReindex: number[];
    try {
      bottleIdsToReindex = await db.transaction(async (tx) => {
        const [alias] = await tx
          .select()
          .from(bottleAliases)
          .where(
            eq(sql`LOWER(${bottleAliases.name})`, input.alias.toLowerCase()),
          )
          .limit(1);

        if (!alias) {
          throw errors.NOT_FOUND({
            message: "Bottle Alias not found.",
          });
        }

        const reindexBottleIds = new Set<number>();
        const legacyBottleId = alias.bottleId;
        if (legacyBottleId !== null) {
          reindexBottleIds.add(legacyBottleId);
        }
        const legacyBottle =
          alias.targetId !== null || legacyBottleId === null
            ? null
            : ((await tx.query.bottles.findFirst({
                where: (bottles, { eq }) => eq(bottles.id, legacyBottleId),
              })) ?? null);

        let authoritativeBottle = legacyBottle;
        if (alias.targetId !== null) {
          const target = await resolveCatalogTargetForAssignment(
            { kind: "target", targetId: alias.targetId },
            tx,
          );
          if (target.bottleId === null) {
            authoritativeBottle = null;
          } else {
            const exactBottleId = target.bottleId;
            const targetBottle = await tx.query.bottles.findFirst({
              where: (bottles, { eq }) => eq(bottles.id, exactBottleId),
            });
            if (!targetBottle) {
              throw new CatalogTargetIntegrityMismatchError(
                { targetId: alias.targetId },
                "the exact alias target Bottle could not be loaded",
              );
            }
            authoritativeBottle = targetBottle;
            reindexBottleIds.add(targetBottle.id);
          }
        }

        if (
          authoritativeBottle &&
          alias.name.toLowerCase() ===
            authoritativeBottle.fullName.toLowerCase()
        ) {
          throw errors.BAD_REQUEST({
            message: "Cannot delete canonical name",
          });
        }

        const storePriceAliasIdentity =
          alias.targetId !== null
            ? eq(storePrices.targetId, alias.targetId)
            : and(
                isNull(storePrices.targetId),
                sql`${storePrices.bottleId} IS NOT DISTINCT FROM ${alias.bottleId}`,
                sql`${storePrices.releaseId} IS NOT DISTINCT FROM ${alias.releaseId}`,
              );
        const reviewAliasIdentity =
          alias.targetId !== null
            ? eq(reviews.targetId, alias.targetId)
            : and(
                isNull(reviews.targetId),
                sql`${reviews.bottleId} IS NOT DISTINCT FROM ${alias.bottleId}`,
                sql`${reviews.releaseId} IS NOT DISTINCT FROM ${alias.releaseId}`,
              );

        // Clear only consumers that still carry this alias assignment.
        await tx
          .update(storePrices)
          .set({
            bottleId: null,
            releaseId: null,
            targetId: null,
          })
          .where(
            and(
              eq(sql`LOWER(${storePrices.name})`, alias.name.toLowerCase()),
              storePriceAliasIdentity,
            ),
          );
        await tx
          .update(reviews)
          .set({
            bottleId: null,
            releaseId: null,
            targetId: null,
          })
          .where(
            and(
              eq(sql`LOWER(${reviews.name})`, alias.name.toLowerCase()),
              reviewAliasIdentity,
            ),
          );

        // Concurrent reassignment must roll back the earlier consumer clears.
        const [clearedAlias] = await tx
          .update(bottleAliases)
          .set({ bottleId: null, releaseId: null, targetId: null })
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

        return Array.from(reindexBottleIds);
      });
    } catch (err) {
      if (err instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: err.message });
      }
      throw err;
    }

    await Promise.all(
      bottleIdsToReindex.map(async (bottleId) => {
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
      }),
    );

    return {};
  });
