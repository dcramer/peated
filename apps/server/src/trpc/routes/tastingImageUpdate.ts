import { eq } from "drizzle-orm";

import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure } from "..";
import config from "../../config";
import { compressAndResizeImage, storeFile } from "../../lib/uploads";

export default authedProcedure
  .input(
    z.object({
      tasting: z.number(),
      name: z.string(),
      data: z.string(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, input.tasting))
      .limit(1);
    if (!tasting) {
      throw new TRPCError({
        message: "Tasting not found",
        code: "NOT_FOUND",
      });
    }

    if (tasting.createdById !== ctx.user.id && !ctx.user.admin) {
      throw new TRPCError({
        message: "Cannot update another person's tasting",
        code: "FORBIDDEN",
      });
    }

    const imageUrl = await storeFile({
      data: {
        data: input.data,
        name: input.name,
      },
      namespace: `tastings`,
      urlPrefix: "/uploads",
      onProcess: (...args) => compressAndResizeImage(...args, undefined, 1024),
    });

    await db
      .update(tastings)
      .set({
        imageUrl,
      })
      .where(eq(tastings.id, tasting.id));

    return {
      imageUrl: imageUrl ? `${config.API_SERVER}${imageUrl}` : null,
    };
  });
