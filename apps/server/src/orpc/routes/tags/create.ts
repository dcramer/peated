import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { TagInputSchema, TagSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/tags",
    summary: "Create tag",
    spec: {},
    description:
      "Create a new tag with synonyms, category, and flavor profiles. Requires moderator privileges",
  })
  .input(TagInputSchema)
  .output(TagSchema)
  .handler(async function ({ input, context, errors }) {
    const tag = await db.transaction(async (tx) => {
      try {
        const [tag] = await tx
          .insert(tags)
          .values({
            name: input.name.toLowerCase(),
            synonyms: (input.synonyms || []).map((s) => s.toLowerCase()),
            tagCategory: input.tagCategory,
            flavorProfiles: input.flavorProfiles || [],
          })
          .returning();
        return tag;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "tag_pkey") {
          throw errors.CONFLICT({
            message: "Tag with name already exists.",
            cause: err,
          });
        }
        throw err;
      }
    });

    if (!tag) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create tag.",
      });
    }

    return await serialize(TagSerializer, tag, context.user);
  });
