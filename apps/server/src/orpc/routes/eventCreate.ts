import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { EventInputSchema, EventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { z } from "zod";
import { procedure } from "..";
import { requireAdmin } from "../middleware";

export default procedure
  .use(requireAdmin)
  .route({ method: "POST", path: "/events" })
  .input(EventInputSchema)
  .output(EventSchema)
  .handler(async function ({ input, context }) {
    const event = await db.transaction(async (tx) => {
      try {
        const [event] = await tx.insert(events).values(input).returning();
        return event;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "event_name") {
          throw new ORPCError("CONFLICT", {
            message: "Event already exists.",
            cause: err,
          });
        }
        throw err;
      }
    });

    if (!event) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create event.",
      });
    }

    return await serialize(EventSerializer, event, context.user);
  });
