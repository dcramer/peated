import { db } from "@peated/server/db";
import type { NewFlight } from "@peated/server/db/schema";
import { flightBottles, flights } from "@peated/server/db/schema";
import { generatePublicId } from "@peated/server/lib/publicId";
import { FlightInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { TRPCError } from "@trpc/server";
import { authedProcedure } from "..";

export default authedProcedure
  .input(FlightInputSchema)
  .mutation(async function ({ input, ctx }) {
    const data: NewFlight = {
      ...input,
      publicId: generatePublicId(),
      createdById: ctx.user.id,
    };

    const flight = await db.transaction(async (tx) => {
      const [flight] = await tx.insert(flights).values(data).returning();

      if (input.bottles) {
        for (const bottle of input.bottles) {
          await tx.insert(flightBottles).values({
            flightId: flight.id,
            bottleId: bottle,
          });
        }
      }

      return flight;
    });

    if (!flight) {
      throw new TRPCError({
        message: "Failed to create flight.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(FlightSerializer, flight, ctx.user);
  });
