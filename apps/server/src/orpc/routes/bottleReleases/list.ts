import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottleReleases,
  bottleTombstones,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import {
  CatalogTargetResolutionError,
  loadCatalogTargetByLegacyReference,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { BottleReleaseSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { projectLegacyBottleRelease } from "./project-legacy-release";

const SORT_OPTIONS = [
  "name",
  "-name",
  "edition",
  "-edition",
  "statedAge",
  "-statedAge",
  "vintageYear",
  "-vintageYear",
  "releaseYear",
  "-releaseYear",
  "numTastings",
  "-numTastings",
  "avgRating",
  "-avgRating",
] as const;

const DEFAULT_SORT = "releaseYear";
const promotedBottles = alias(bottles, "promoted_bottles");

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/releases",
    summary: "List bottle bottlings",
    description:
      "Retrieve bottlings for a specific bottle with search, sorting, and pagination support",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleReleases",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      query: z.coerce.string().default(""),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
    }),
  )
  // TODO(response-envelope): helper enables later switch to { data, meta }
  .output(listResponse(BottleReleaseSchema))
  .handler(async function ({ input, context, errors }) {
    const { query, cursor, limit, sort, ...rest } = input;
    const offset = (cursor - 1) * limit;

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, rest.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const where: (SQL<unknown> | undefined)[] = [
      eq(bottleReleases.bottleId, bottle.id),
      sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${promotedBottles.id})`,
      sql`NOT EXISTS(SELECT FROM ${bottleGroupTombstones} WHERE ${bottleGroupTombstones.groupId} = ${catalogTargets.groupId})`,
    ];

    if (query) {
      where.push(
        sql`${promotedBottles.searchVector} @@ websearch_to_tsquery ('english', ${query})`,
      );
    }

    let orderBy: SQL<unknown>;
    switch (sort) {
      case "edition":
        orderBy = asc(promotedBottles.edition);
        break;
      case "-edition":
        orderBy = desc(promotedBottles.edition);
        break;
      case "name":
        orderBy = asc(promotedBottles.name);
        break;
      case "-name":
        orderBy = desc(promotedBottles.name);
        break;
      case "statedAge":
        orderBy = sql`${promotedBottles.statedAge} ASC NULLS FIRST`;
        break;
      case "-statedAge":
        orderBy = sql`${promotedBottles.statedAge} DESC NULLS LAST`;
        break;
      case "vintageYear":
        orderBy = sql`${promotedBottles.vintageYear} ASC NULLS FIRST`;
        break;
      case "-vintageYear":
        orderBy = sql`${promotedBottles.vintageYear} DESC NULLS LAST`;
        break;
      case "releaseYear":
        orderBy = sql`${promotedBottles.releaseYear} ASC NULLS FIRST`;
        break;
      case "-releaseYear":
        orderBy = sql`${promotedBottles.releaseYear} DESC NULLS LAST`;
        break;
      case "numTastings":
        orderBy = asc(promotedBottles.totalTastings);
        break;
      case "-numTastings":
        orderBy = desc(promotedBottles.totalTastings);
        break;
      case "avgRating":
        orderBy = sql`${promotedBottles.avgRating} ASC NULLS LAST`;
        break;
      case "-avgRating":
        orderBy = sql`${promotedBottles.avgRating} DESC NULLS LAST`;
        break;
      default:
        orderBy = asc(promotedBottles.name);
    }

    const results = await db
      .select({
        releaseId: bottleReleases.id,
        legacyBottleId: bottleReleases.bottleId,
        targetId: catalogTargets.id,
        bottle: promotedBottles,
      })
      .from(bottleReleases)
      .innerJoin(
        bottleReleasePromotions,
        and(
          eq(bottleReleasePromotions.releaseId, bottleReleases.id),
          eq(bottleReleasePromotions.status, "promoted"),
        ),
      )
      .innerJoin(
        promotedBottles,
        eq(promotedBottles.id, bottleReleasePromotions.promotedBottleId),
      )
      .innerJoin(
        catalogTargets,
        and(
          eq(catalogTargets.bottleId, promotedBottles.id),
          eq(catalogTargets.groupId, promotedBottles.groupId),
        ),
      )
      .where(where ? and(...where) : undefined)
      .orderBy(orderBy, asc(bottleReleases.id))
      .limit(limit + 1)
      .offset(offset);

    const page = results.slice(0, limit);
    await Promise.all(
      page.map(async (result) => {
        let target;
        try {
          target = await loadCatalogTargetByLegacyReference(
            {
              bottleId: result.legacyBottleId,
              releaseId: result.releaseId,
            },
            {
              actor: null,
              permissions: { canReadCatalogIdentity: true },
              caller: "bottleReleases.list",
              operation: "read_promoted_bottle",
            },
          );
        } catch (error) {
          if (error instanceof CatalogTargetResolutionError) {
            throw errors.CONFLICT({ message: error.message, cause: error });
          }
          throw error;
        }

        if (
          target.kind !== "bottle" ||
          target.targetId !== result.targetId ||
          target.bottle.id !== result.bottle.id
        ) {
          throw errors.CONFLICT({
            message:
              "BottleRelease promotion does not match its active exact Bottle target.",
          });
        }
      }),
    );

    const serializedBottles = await serialize(
      BottleSerializer,
      page.map(({ bottle }) => bottle),
      context.user,
    );

    return {
      results: page.map((result, index) =>
        projectLegacyBottleRelease(
          {
            id: result.releaseId,
            bottleId: result.legacyBottleId,
          },
          serializedBottles[index]!,
        ),
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
