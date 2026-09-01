import { db } from "@peated/server/db";
import { countries, events } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { EventInputSchema, EventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { eq } from "drizzle-orm";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/events",
    summary: "Create event",
    description:
      "Create a new whisky event with dates and details. Requires admin privileges",
    operationId: "createEvent",
  })
  .input(EventInputSchema)
  .output(EventSchema)
  .handler(async function ({ input, context, errors }) {
    const event = await db.transaction(async (tx) => {
      if (input.country) {
        const [country] = await tx
          .select({ id: countries.id })
          .from(countries)
          .where(eq(countries.id, input.country))
          .limit(1);
        if (!country) {
          throw errors.NOT_FOUND({ message: "Country not found." });
        }
      }

      try {
        const [event] = await tx
          .insert(events)
          .values({
            name: input.name,
            dateStart: input.dateStart,
            dateEnd: input.dateEnd,
            repeats: input.repeats,
            website: input.website,
            description: input.description,
            countryId: input.country,
            address: input.address,
            location: input.location,
          })
          .returning();
        return event;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "event_name_unq") {
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
