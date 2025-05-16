import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { FlightSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/flights/:id" })
  .input(
    z.object({
      id: z.coerce.string(),
    }),
  )
  .output(FlightSchema)
  .handler(async function ({ input, context, errors }) {
    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, input.id));
    if (!flight) {
      throw errors.NOT_FOUND({
        message: "Flight not found.",
      });
    }

    return await serialize(FlightSerializer, flight, context.user);
  });
