import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BadgeSchema, detailsResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/badges/{badge}",
    summary: "Get badge details",
    description:
      "Retrieve detailed information about a specific achievement badge",
    operationId: "getBadge",
  })
  .input(z.object({ badge: z.coerce.number() }))
  // TODO(response-envelope): wrap in { data } by updating detailsResponse() at cutover
  .output(detailsResponse(BadgeSchema))
  .handler(async function ({ input, context, errors }) {
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, input.badge));
    if (!badge) {
      throw errors.NOT_FOUND({
        message: "Badge not found.",
      });
    }
    return await serialize(BadgeSerializer, badge, context.user);
  });
