import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { EventInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "..";

export default adminProcedure.input(EventInputSchema).mutation(async function ({
  input,
  ctx,
}) {
  const event = await db.transaction(async (tx) => {
    try {
      const [event] = await tx.insert(events).values(input).returning();
      return event;
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "event_name") {
        throw new TRPCError({
          message: "Event already exists.",
          code: "CONFLICT",
          cause: err,
        });
      }
      throw err;
    }
  });

  if (!event) {
    throw new TRPCError({
      message: "Failed to create event.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(EventSerializer, event, ctx.user);
});
