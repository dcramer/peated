import { db } from "@peated/server/db";
import type { Event } from "@peated/server/db/schema";
import { countries, events } from "@peated/server/db/schema";
import { EventInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";

export default adminProcedure
  .input(
    EventInputSchema.partial().extend({
      id: z.number(),
    }),
  )
  .mutation(async function ({
    input: { id, country: countryId, ...input },
    ctx,
  }) {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
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
      return await serialize(EventSerializer, event, ctx.user);
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
          throw new TRPCError({
            message: "Event already exists.",
            code: "CONFLICT",
            cause: err,
          });
        }
        throw err;
      }

      if (!newEvent) return;

      return newEvent;
    });

    if (!newEvent) {
      throw new TRPCError({
        message: "Failed to update event.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(EventSerializer, newEvent, ctx.user);
  });
