import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { TagSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/tags/:name" })
  .input(z.object({ name: z.string() }))
  .output(TagSchema)
  .handler(async function ({ input, context, errors }) {
    const [tag] = await db.select().from(tags).where(eq(tags.name, input.name));
    if (!tag) {
      throw errors.NOT_FOUND({
        message: "Tag not found.",
      });
    }
    return await serialize(TagSerializer, tag, context.user);
  });
