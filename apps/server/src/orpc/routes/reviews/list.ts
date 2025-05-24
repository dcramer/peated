import { db } from "@peated/server/db";
import { externalSites, reviews } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  CursorSchema,
  ExternalSiteTypeEnum,
  ReviewSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    site: ExternalSiteTypeEnum.optional(),
    bottle: z.coerce.number().optional(),
    query: z.string().default(""),
    onlyUnknown: z.coerce.boolean().optional(),
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(100),
  })
  .default({
    query: "",
    cursor: 1,
    limit: 100,
  });

const OutputSchema = z.object({
  results: z.array(ReviewSchema),
  rel: CursorSchema,
});

export default procedure
  .route({ method: "GET", path: "/reviews" })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    context,
    errors,
  }) {
    const where: (SQL<unknown> | undefined)[] = [eq(reviews.hidden, false)];

    if (input.site) {
      const site = await db.query.externalSites.findFirst({
        where: eq(externalSites.type, input.site),
      });

      if (!site) {
        throw errors.NOT_FOUND({
          message: "Site not found.",
        });
      }
      where.push(eq(reviews.externalSiteId, site.id));
    }

    if (input.onlyUnknown) {
      where.push(isNull(reviews.bottleId));
    }

    if (input.bottle) {
      where.push(eq(reviews.bottleId, input.bottle));
    } else if (!context.user?.admin && !context.user?.mod) {
      console.error(
        `User requested reviewList without mod: ${context.user?.id}`,
      );
      throw errors.BAD_REQUEST({
        message: "Must be a moderator to list all reviews.",
      });
    }

    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(reviews.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(reviews)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(reviews.name));

    return {
      results: await serialize(
        ReviewSerializer,
        results.slice(0, limit),
        context.user,
        [...(input.site ? ["site"] : []), ...(input.bottle ? ["bottle"] : [])],
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
