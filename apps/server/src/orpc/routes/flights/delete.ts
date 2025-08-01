import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "DELETE",
    path: "/flights/{flight}",
    summary: "Delete flight",
    spec: {
      operationId: "deleteFlight",
    },
    description: "Delete a tasting flight. Requires admin privileges",
  })
  .use(requireAdmin)
  .input(
    z.object({
      flight: z.string(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const { flight: flightId } = input;

    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, flightId))
      .limit(1);
    if (!flight) {
      throw errors.NOT_FOUND({
        message: "Flight not found.",
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(flights).where(eq(flights.id, flight.id));
    });

    return {};
  });
