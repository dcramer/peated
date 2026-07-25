import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  follows,
  tastings,
  users,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { recordCatalogTargetReadFilterParity } from "@peated/server/lib/catalogTargetReadParity";
import {
  CatalogTargetResolutionError,
  resolveCatalogTargetForAssignment,
  resolveLegacyCatalogTargetFilterForRead,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { TastingSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    target: z.coerce.number().int().positive().optional(),
    bottle: z.coerce.number().gte(1).optional(),
    release: z.coerce.number().gte(1).optional(),
    entity: z.coerce.number().optional(),
    user: z.union([z.coerce.number(), z.literal("me"), z.string()]).optional(),
    filter: z.enum(["global", "friends", "local"]).default("global"),
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(25),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      input.target !== undefined &&
      (input.bottle !== undefined || input.release !== undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Target cannot be combined with retained Bottle input.",
        path: ["target"],
      });
    }
  })
  .default({
    filter: "global",
    cursor: 1,
    limit: 25,
  });

export default procedure
  .route({
    method: "GET",
    path: "/tastings",
    summary: "List tastings",
    description:
      "Retrieve tastings with filtering by bottle, entity, user, and privacy settings. Supports pagination",
    operationId: "listTastings",
  })
  .input(InputSchema)
  // TODO(response-envelope): helper enables later switch to { data, meta }
  .output(listResponse(TastingSchema))
  .handler(async function ({
    input: { cursor, limit, ...input },
    context,
    errors,
  }) {
    const offset = (cursor - 1) * limit;

    const baseWhere: (SQL<unknown> | undefined)[] = [];
    const targetWhere: SQL<unknown>[] = [];
    const parityFilters: {
      filter: "catalog_reference" | "entity";
      targetWhere: SQL<unknown>;
      legacyWhere: SQL<unknown>;
    }[] = [];

    if (input.target !== undefined) {
      try {
        const target = await resolveCatalogTargetForAssignment({
          kind: "target",
          targetId: input.target,
        });
        targetWhere.push(eq(tastings.targetId, target.targetId));
      } catch (error) {
        if (error instanceof CatalogTargetResolutionError) {
          throw errors.BAD_REQUEST({
            message: "Cannot identify catalog target.",
            cause: error,
          });
        }
        throw error;
      }
    }

    if (input.bottle || input.release) {
      const target = await resolveLegacyCatalogTargetFilterForRead(
        {
          bottleId: input.bottle,
          releaseId: input.release,
        },
        { caller: "tastings.list", operation: "filter" },
      );
      const authoritativeWhere = target
        ? eq(tastings.targetId, target.targetId)
        : sql`false`;
      const legacyWhere = and(
        input.bottle === undefined
          ? undefined
          : eq(tastings.bottleId, input.bottle),
        input.release === undefined
          ? undefined
          : eq(tastings.releaseId, input.release),
      )!;
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "catalog_reference",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    }

    if (input.entity) {
      const authoritativeWhere = sql`EXISTS(
          SELECT FROM ${catalogTargets}
          WHERE ${catalogTargets.id} = ${tastings.targetId}
            AND (
              (${catalogTargets.bottleId} IS NOT NULL AND EXISTS(
                SELECT FROM ${bottles}
                WHERE ${bottles.id} = ${catalogTargets.bottleId}
                  AND (${bottles.brandId} = ${input.entity}
                    OR ${bottles.bottlerId} = ${input.entity}
                    OR EXISTS(
                      SELECT FROM ${bottlesToDistillers}
                      WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                        AND ${bottlesToDistillers.distillerId} = ${input.entity}
                    ))
              ))
              OR (${catalogTargets.bottleId} IS NULL AND EXISTS(
                SELECT FROM ${bottleGroups}
                WHERE ${bottleGroups.id} = ${catalogTargets.groupId}
                  AND (${bottleGroups.brandId} = ${input.entity}
                    OR ${bottleGroups.bottlerId} = ${input.entity}
                    OR EXISTS(
                      SELECT FROM ${bottleGroupDistillers}
                      WHERE ${bottleGroupDistillers.groupId} = ${bottleGroups.id}
                        AND ${bottleGroupDistillers.distillerId} = ${input.entity}
                    ))
              ))
            )
          )`;
      const legacyWhere = sql`EXISTS(
        SELECT FROM ${bottles}
        WHERE (${bottles.brandId} = ${input.entity}
          OR ${bottles.bottlerId} = ${input.entity}
          OR EXISTS(
            SELECT FROM ${bottlesToDistillers}
            WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
              AND ${bottlesToDistillers.distillerId} = ${input.entity}
          )) AND ${bottles.id} = ${tastings.bottleId}
      )`;
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "entity",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    }

    if (input.user) {
      const selectedUser = await getUserFromId(db, input.user, context.user);

      if (!selectedUser) {
        if (input.user === "me") {
          throw errors.UNAUTHORIZED();
        } else {
          throw errors.NOT_FOUND({
            message: "User not found.",
          });
        }
      }

      baseWhere.push(eq(tastings.createdById, selectedUser.id));
    }

    const limitPrivate = input.filter !== "friends";
    if (input.filter === "friends") {
      if (!context.user) {
        throw errors.UNAUTHORIZED();
      }
      baseWhere.push(
        sql`${tastings.createdById} IN (SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${context.user.id} AND ${follows.status} = 'following')`,
      );
    }

    if (limitPrivate) {
      baseWhere.push(
        or(
          eq(users.private, false),
          ...(context.user
            ? [
                eq(tastings.createdById, context.user.id),
                sql`${tastings.createdById} IN (
                  SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${context.user.id} AND ${follows.status} = 'following'
                )`,
              ]
            : []),
        ),
      );
    }

    const results = await db
      .select({ tastings })
      .from(tastings)
      .innerJoin(users, eq(users.id, tastings.createdById))
      .where(and(...baseWhere, ...targetWhere))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(tastings.createdAt));

    await Promise.all(
      parityFilters.map(async (parityFilter) => {
        const candidates = await db
          .select({
            id: tastings.id,
            targetId: tastings.targetId,
            bottleId: tastings.bottleId,
            releaseId: tastings.releaseId,
            targetMatches: sql<boolean>`COALESCE(${parityFilter.targetWhere}, false)`,
            legacyMatches: sql<boolean>`COALESCE(${parityFilter.legacyWhere}, false)`,
          })
          .from(tastings)
          .innerJoin(users, eq(users.id, tastings.createdById))
          .where(
            and(
              ...baseWhere,
              or(parityFilter.targetWhere, parityFilter.legacyWhere),
            ),
          )
          .limit(limit + 1)
          .offset(offset)
          .orderBy(desc(tastings.createdAt));

        recordCatalogTargetReadFilterParity(
          candidates.map((candidate) => ({
            consumerTable: "tasting",
            rowLocator: { id: candidate.id },
            targetId: candidate.targetId,
            legacy: {
              bottleId: candidate.bottleId,
              releaseId: candidate.releaseId,
            },
            filter: parityFilter.filter,
            targetMatches: candidate.targetMatches,
            legacyMatches: candidate.legacyMatches,
          })),
          { caller: "tastings.list", operation: "filter" },
        );
      }),
    );

    return {
      results: await serialize(
        TastingSerializer,
        results.map((t) => t.tastings).slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
