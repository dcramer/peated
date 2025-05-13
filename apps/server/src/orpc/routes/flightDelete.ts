import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "DELETE", path: "/flights/:id" })
  .use(requireAdmin)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input }) {
    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, input.id))
      .limit(1);
    if (!flight) {
      throw new ORPCError("NOT_FOUND", {
        message: "Flight not found.",
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(flights).where(eq(flights.id, flight.id));
    });

    return {};
  });
