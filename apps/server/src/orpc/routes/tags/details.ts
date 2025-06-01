import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { TagSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/tags/{tag}",
    summary: "Get tag details",
    description:
      "Retrieve detailed information about a specific tag by its name",
  })
  .input(z.object({ tag: z.string() }))
  .output(TagSchema)
  .handler(async ({ input, context, errors }) => {
    const [tag] = await db.select().from(tags).where(eq(tags.name, input.tag));
    if (!tag) {
      throw errors.NOT_FOUND({
        message: "Tag not found.",
      });
    }
    return await serialize(TagSerializer, tag, context.user);
  });
