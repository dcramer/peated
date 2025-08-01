import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { FlightSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  // we use the publicId as the route param here as an easy solution
  // to make the flight private (through obscuring the id)
  .route({
    method: "GET",
    path: "/flights/{flight}",
    summary: "Get flight details",
    spec: {
      operationId: "getFlightDetails",
    },
    description:
      "Retrieve detailed information about a specific tasting flight using its public ID",
  })
  .input(z.object({ flight: z.string() }))
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const { flight: flightId } = input;

    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, flightId));
    if (!flight) {
      throw errors.NOT_FOUND({
        message: "Flight not found.",
      });
    }

    return await serialize(FlightSerializer, flight, context.user);
  });
