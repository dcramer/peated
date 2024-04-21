import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { TagInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { TRPCError } from "@trpc/server";
import { modProcedure } from "..";

export default modProcedure.input(TagInputSchema).mutation(async function ({
  input,
  ctx,
}) {
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
        throw new TRPCError({
          message: "Tag with name already exists.",
          code: "CONFLICT",
          cause: err,
        });
      }
      throw err;
    }
  });

  if (!tag) {
    throw new TRPCError({
      message: "Failed to create tag.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(TagSerializer, tag, ctx.user);
});
