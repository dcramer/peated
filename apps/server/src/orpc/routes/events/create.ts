import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { EventInputSchema, EventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/events",
    summary: "Create event",
    spec: {},
    description:
      "Create a new whisky event with dates and details. Requires admin privileges",
  })
  .input(EventInputSchema)
  .output(EventSchema)
  .handler(async function ({ input, context, errors }) {
    const event = await db.transaction(async (tx) => {
      try {
        const [event] = await tx.insert(events).values(input).returning();
        return event;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "event_name") {
          throw errors.CONFLICT({
            message: "Event already exists.",
            cause: err,
          });
        }
        throw err;
      }
    });

    if (!event) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create event.",
      });
    }

    return await serialize(EventSerializer, event, context.user);
  });
