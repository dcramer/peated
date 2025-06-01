import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { EventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/events/{event}",
    summary: "Get event details",
    description: "Retrieve detailed information about a specific whisky event",
  })
  .input(z.object({ event: z.coerce.number() }))
  .output(EventSchema)
  .handler(async ({ input, context, errors }) => {
    const { event: eventId } = input;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    if (!event) {
      throw errors.NOT_FOUND({
        message: "Event not found.",
      });
    }
    return await serialize(EventSerializer, event, context.user);
  });
