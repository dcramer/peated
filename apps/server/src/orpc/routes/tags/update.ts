import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { TagInputSchema, TagSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/tags/{tag}",
    operationId: "updateTag",
    summary: "Update tag",
    description:
      "Update tag properties including category, flavor profiles, and synonyms. Requires moderator privileges",
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

    const data: { [name: string]: any } = {};

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

    return await serialize(TagSerializer, newTag, context.user);
  });
