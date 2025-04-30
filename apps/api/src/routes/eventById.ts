import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../trpc";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  const [event] = await db.select().from(events).where(eq(events.id, input));
  if (!event) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }
  return await serialize(EventSerializer, event, ctx.user);
});
