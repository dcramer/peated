import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { EventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "GET", path: "/events/:id" })
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(EventSchema)
  .handler(async function ({ input, context }) {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, input.id));
    if (!event) {
      throw new ORPCError("NOT_FOUND", {
        message: "Event not found.",
      });
    }
    return await serialize(EventSerializer, event, context.user);
  });
