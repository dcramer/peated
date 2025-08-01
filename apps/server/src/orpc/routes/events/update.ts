import { db } from "@peated/server/db";
import type { Event } from "@peated/server/db/schema";
import { countries, events } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { EventInputSchema, EventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "PATCH",
    path: "/events/{event}",
    operationId: "updateEvent",
    summary: "Update event",
    description:
      "Update event information including dates, location, and details. Requires admin privileges",
  })
  .input(EventInputSchema.partial().extend({ event: z.coerce.number() }))
  .output(EventSchema)
  .handler(async function ({ input, context, errors }) {
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

    if (input.country) {
      const [country] = await db
        .select()
        .from(countries)
        .where(eq(countries.id, input.country));
      if (!country) {
        throw errors.NOT_FOUND({
          message: "Country not found.",
        });
      }
    }

    const data: { [name: string]: any } = {};
    Object.entries(input).map(([k, v]) => {
      if (v !== undefined && v !== event[k as keyof Event]) {
        data[k] = v;
      }
    });

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
          throw errors.CONFLICT({
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
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update event.",
      });
    }

    return await serialize(EventSerializer, newEvent, context.user);
  });
