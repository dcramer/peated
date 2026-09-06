import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import {
  bottleTags,
  externalReviews,
  memberReviews,
  tags,
  tastings,
} from "@peated/server/db/schema";
import { dispatchBottleStatsRecomputes } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { arraysEqual } from "@peated/server/lib/equals";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { TagInputSchema, TagSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/tags/{tag}",
    summary: "Update tag",
    description:
      "Update tag properties including category, flavor profiles, and synonyms. Requires moderator privileges",
    operationId: "updateTag",
  })
  .input(
    TagInputSchema.partial().extend({
      tag: z.string(),
    }),
  )
  .output(TagSchema)
  .handler(async function ({ input, context, errors }) {
    const [tag] = await db.select().from(tags).where(eq(tags.name, input.tag));
    if (!tag) {
      throw errors.NOT_FOUND({
        message: "Tag not found.",
      });
    }

    const data: Partial<typeof tags.$inferInsert> = {};

    if (input.tagCategory && input.tagCategory !== tag.tagCategory) {
      data.tagCategory = input.tagCategory;
    }

    if (
      input.flavorProfiles &&
      input.flavorProfiles !== undefined &&
      !arraysEqual(input.flavorProfiles, tag.flavorProfiles)
    ) {
      data.flavorProfiles = input.flavorProfiles;
    }

    if (
      input.synonyms &&
      input.synonyms !== undefined &&
      !arraysEqual(input.synonyms, tag.synonyms)
    ) {
      data.synonyms = input.synonyms;
    }

    if (Object.values(data).length === 0) {
      return await serialize(TagSerializer, tag, context.user);
    }

    let affectedBottleIds: number[] = [];
    if (data.tagCategory !== undefined || data.synonyms !== undefined) {
      const names = [tag.name, ...tag.synonyms, ...(data.synonyms ?? [])];
      const namesSql = sql`ARRAY[${sql.join(
        names.map((name) => sql`${name}`),
        sql`, `,
      )}]::varchar[]`;
      const affected = await db.execute<{ bottleId: number | string }>(sql`
        SELECT ${bottleTags.bottleId} AS "bottleId"
        FROM ${bottleTags}
        WHERE ${bottleTags.tag} = ${tag.name}
        UNION
        SELECT ${tastings.bottleId} AS "bottleId"
        FROM ${tastings}
        WHERE ${tastings.tags} && ${namesSql}
        UNION
        SELECT ${memberReviews.bottleId} AS "bottleId"
        FROM ${memberReviews}
        WHERE ${memberReviews.tags} && ${namesSql}
        UNION
        SELECT ${externalReviews.bottleId} AS "bottleId"
        FROM ${externalReviews}
        WHERE ${externalReviews.bottleId} IS NOT NULL
          AND ${externalReviews.tags} && ${namesSql}
      `);
      affectedBottleIds = affected.rows.map(({ bottleId }) => Number(bottleId));
    }

    const [newTag] = await db
      .update(tags)
      .set(data)
      .where(eq(tags.name, tag.name))
      .returning();

    if (!newTag) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update tag.",
      });
    }

    if (affectedBottleIds.length) {
      await dispatchBottleStatsRecomputes("tag", tag.name, affectedBottleIds);
    }

    return await serialize(TagSerializer, newTag, context.user);
  });
