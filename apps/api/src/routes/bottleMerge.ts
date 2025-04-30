import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "../trpc";

export default modProcedure
  .input(
    z.object({
      root: z.number(),
      other: z.number(),
      direction: z.enum(["mergeInto", "mergeFrom"]).default("mergeInto"),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    if (input.root === input.other) {
      throw new TRPCError({
        message: "Cannot merge a bottle into itself.",
        code: "BAD_REQUEST",
      });
    }

    const [rootBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.root));

    if (!rootBottle) {
      throw new TRPCError({
        message: "root not found.",
        code: "NOT_FOUND",
      });
    }

    const [otherBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.other));

    if (!otherBottle) {
      throw new TRPCError({
        message: "other not found.",
        code: "NOT_FOUND",
      });
    }

    // if mergeInto, rootEntity merges into otherEntity
    const fromBottle =
      input.direction === "mergeInto" ? rootBottle : otherBottle;
    const toBottle = input.direction === "mergeInto" ? otherBottle : rootBottle;

    await pushJob("MergeBottle", {
      toBottleId: toBottle.id,
      fromBottleIds: [fromBottle.id],
    });

    return await serialize(BottleSerializer, toBottle, ctx.user);
  });
