import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { flights } from "../db/schema";
import { adminProcedure } from "../trpc";

export default adminProcedure.input(z.string()).mutation(async function ({
  input,
  ctx,
}) {
  const [flight] = await db
    .select()
    .from(flights)
    .where(eq(flights.publicId, input))
    .limit(1);
  if (!flight) {
    throw new TRPCError({
      message: "Flight not found.",
      code: "NOT_FOUND",
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(flights).where(eq(flights.id, flight.id));
  });

  return {};
});
