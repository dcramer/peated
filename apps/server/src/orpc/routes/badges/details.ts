import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BadgeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/badges/:id" })
  .input(z.number())
  .output(BadgeSchema)
  .handler(async function ({ input, context }) {
    const [badge] = await db.select().from(badges).where(eq(badges.id, input));
    if (!badge) {
      throw new ORPCError("NOT_FOUND");
    }
    return await serialize(BadgeSerializer, badge, context.user);
  });
