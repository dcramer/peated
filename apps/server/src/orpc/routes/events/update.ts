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
    summary: "Update event",
    description:
      "Update event information including dates, location, and details. Requires admin privileges",
    operationId: "updateEvent",
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

    const data: Partial<typeof events.$inferInsert> = {};
    if (input.name !== undefined && input.name !== event.name)
      data.name = input.name;
    if (input.dateStart !== undefined && input.dateStart !== event.dateStart)
      data.dateStart = input.dateStart;
    if (input.dateEnd !== undefined && input.dateEnd !== event.dateEnd)
      data.dateEnd = input.dateEnd;
    if (input.repeats !== undefined && input.repeats !== event.repeats)
      data.repeats = input.repeats;
    if (input.website !== undefined && input.website !== event.website)
      data.website = input.website;
    if (
      input.description !== undefined &&
      input.description !== event.description
    )
      data.description = input.description;
    if (input.country !== undefined && input.country !== event.countryId)
      data.countryId = input.country;
    if (input.location !== undefined && input.location !== event.location)
      data.location = input.location;

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
