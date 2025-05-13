import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import type { Event } from "@peated/server/db/schema";
import { countries, events } from "@peated/server/db/schema";
import { EventInputSchema, EventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAdmin } from "../middleware";

export default procedure
  .use(requireAdmin)
  .route({ method: "PATCH", path: "/events/:id" })
  .input(
    EventInputSchema.partial().extend({
      id: z.number(),
    }),
  )
  .output(EventSchema)
  .handler(async function ({
    input: { id, country: countryId, ...input },
    context,
  }) {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) {
      throw new ORPCError("NOT_FOUND");
    }

    const data: { [name: string]: any } = {};
    Object.entries(input).map(([k, v]) => {
      if (v !== undefined && v !== event[k as keyof Event]) {
        data[k] = v;
      }
    });

    if (countryId) {
      data.countryId = countryId;
    }

    if (Object.values(data).length === 0) {
      return await serialize(EventSerializer, event, context.user);
    }

    const newEvent = await db.transaction(async (tx) => {
      let newEvent: Event | undefined;
      try {
        [newEvent] = await tx
          .update(events)
          .set(data)
          .where(eq(events.id, event.id))
          .returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "event_name_unq") {
          throw new ORPCError("CONFLICT", {
            message: "Event already exists.",
            cause: err,
          });
        }
        throw err;
      }

      if (!newEvent) return;

      return newEvent;
    });

    if (!newEvent) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update event.",
      });
    }

    return await serialize(EventSerializer, newEvent, context.user);
  });
