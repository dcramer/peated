import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import flightDetailsContract from "@peated/server/orpc/contracts/flights/details";
import { serialize } from "@peated/server/serializers";
import { FlightDetailsSerializer } from "@peated/server/serializers/flight";
import { eq } from "drizzle-orm";

export default implement(flightDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
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

  return await serialize(FlightDetailsSerializer, flight, context.user);
});
