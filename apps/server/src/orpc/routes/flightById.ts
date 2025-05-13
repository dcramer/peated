import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure.input(z.string()).query(async function ({
  input,
  ctx,
}) {
  const [flight] = await db
    .select()
    .from(flights)
    .where(eq(flights.publicId, input));
  if (!flight) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  return await serialize(FlightSerializer, flight, ctx.user);
});
