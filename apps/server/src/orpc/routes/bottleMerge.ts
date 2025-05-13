import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireMod } from "../middleware";

export default procedure
  .use(requireMod)
  .route({ method: "POST", path: "/bottles/:bottle/merge-targets" })
  .input(
    z.object({
      bottle: z.coerce.number(),
      other: z.number(),
      direction: z.enum(["mergeInto", "mergeFrom"]).default("mergeInto"),
    }),
  )
  .output(BottleSchema)
  .handler(async function ({ input, context }) {
    if (input.bottle === input.other) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot merge a bottle into itself.",
      });
    }

    const [rootBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!rootBottle) {
      throw new ORPCError("NOT_FOUND", {
        message: "bottle not found.",
      });
    }

    const [otherBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.other));

    if (!otherBottle) {
      throw new ORPCError("NOT_FOUND", {
        message: "other bottle not found.",
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

    return await serialize(BottleSerializer, toBottle, context.user);
  });
