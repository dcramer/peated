import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { TagInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "../trpc";

export default modProcedure
  .input(
    TagInputSchema.partial().extend({
      name: z.string(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [tag] = await db.select().from(tags).where(eq(tags.name, input.name));
    if (!tag) {
      throw new TRPCError({
        code: "NOT_FOUND",
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
      return await serialize(TagSerializer, tag, ctx.user);
    }

    const [newTag] = await db
      .update(tags)
      .set(data)
      .where(eq(tags.name, tag.name))
      .returning();

    if (!newTag) {
      throw new TRPCError({
        message: "Failed to update tag.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(TagSerializer, newTag, ctx.user);
  });
