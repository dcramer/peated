import { db } from "@peated/server/db";
import { flightBottles, flights } from "@peated/server/db/schema";
import { FlightInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { TRPCError } from "@trpc/server";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "../trpc";

export default authedProcedure
  .input(
    FlightInputSchema.partial().extend({
      flight: z.string(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, input.flight));

    if (!flight) {
      throw new TRPCError({
        message: "Flight not found.",
        code: "NOT_FOUND",
      });
    }

    if (flight.createdById !== ctx.user.id && !ctx.user.mod) {
      throw new TRPCError({
        message: "Cannot update another user's flight.",
        code: "FORBIDDEN",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.name && input.name !== flight.name) {
      data.name = input.name;
    }
    if (
      input.description !== undefined &&
      input.description !== flight.description
    ) {
      data.description = input.description;
    }
    if (input.public !== undefined && input.public !== flight.public) {
      data.public = input.public;
    }

    if (Object.values(data).length === 0 && !input.bottles) {
      return await serialize(FlightSerializer, flight, ctx.user);
    }

    const newFlight = await db.transaction(async (tx) => {
      const [newFlight] = Object.values(data).length
        ? await tx
            .update(flights)
            .set(data)
            .where(eq(flights.id, flight.id))
            .returning()
        : [flight];
      if (!newFlight) return;

      if (input.bottles)
        for (const bottle of input.bottles) {
          await tx
            .delete(flightBottles)
            .where(
              and(
                eq(flightBottles.flightId, flight.id),
                notInArray(flightBottles.bottleId, input.bottles),
              ),
            );

          await tx
            .insert(flightBottles)
            .values({
              flightId: flight.id,
              bottleId: bottle,
            })
            .onConflictDoNothing();
        }

      return newFlight;
    });

    if (!newFlight) {
      throw new TRPCError({
        message: "Failed to update flight.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(FlightSerializer, newFlight, ctx.user);
  });
