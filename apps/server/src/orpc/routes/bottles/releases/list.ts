import { db } from "@peated/server/db";
import { bottleReleases, bottles } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BottleReleaseSchema, CursorSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

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

export default procedure
  .route({ method: "GET", path: "/bottles/{bottle}/releases" })
  .input(
    z.object({
      bottle: z.coerce.number(),
      query: z.coerce.string().default(""),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
    }),
  )
  .output(
    z.object({
      results: z.array(BottleReleaseSchema),
      rel: CursorSchema,
    }),
  )
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
    ];

    if (query) {
      where.push(
        sql`${bottleReleases.searchVector} @@ websearch_to_tsquery ('english', ${query})`,
      );
    }

    let orderBy: SQL<unknown>;
    switch (sort) {
      case "edition":
        orderBy = asc(bottleReleases.edition);
        break;
      case "-edition":
        orderBy = desc(bottleReleases.edition);
        break;
      case "name":
        orderBy = asc(bottleReleases.name);
        break;
      case "-name":
        orderBy = desc(bottleReleases.name);
        break;
      case "statedAge":
        orderBy = sql`${bottleReleases.statedAge} ASC NULLS FIRST`;
        break;
      case "-statedAge":
        orderBy = sql`${bottleReleases.statedAge} DESC NULLS LAST`;
        break;
      case "vintageYear":
        orderBy = sql`${bottleReleases.vintageYear} ASC NULLS FIRST`;
        break;
      case "-vintageYear":
        orderBy = sql`${bottleReleases.vintageYear} DESC NULLS LAST`;
        break;
      case "releaseYear":
        orderBy = sql`${bottleReleases.releaseYear} ASC NULLS FIRST`;
        break;
      case "-releaseYear":
        orderBy = sql`${bottleReleases.releaseYear} DESC NULLS LAST`;
        break;
      case "numTastings":
        orderBy = asc(bottleReleases.totalTastings);
        break;
      case "-numTastings":
        orderBy = desc(bottleReleases.totalTastings);
        break;
      case "avgRating":
        orderBy = sql`${bottleReleases.avgRating} ASC NULLS LAST`;
        break;
      case "-avgRating":
        orderBy = sql`${bottleReleases.avgRating} DESC NULLS LAST`;
        break;
      default:
        orderBy = asc(bottleReleases.name);
    }

    const results = await db
      .select()
      .from(bottleReleases)
      .where(where ? and(...where) : undefined)
      .orderBy(orderBy)
      .limit(limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        BottleReleaseSerializer,
        results.slice(0, limit),
        context.user ?? undefined,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
