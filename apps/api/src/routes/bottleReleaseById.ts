import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { bottleReleases } from "../db/schema";
import { serialize } from "../serializers";
import { BottleReleaseSerializer } from "../serializers/bottleRelease";
import { publicProcedure } from "../trpc";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  const release = await db.query.bottleReleases.findFirst({
    where: eq(bottleReleases.id, input),
    with: {
      bottle: true,
      createdBy: true,
    },
  });

  if (!release) {
    throw new TRPCError({
      message: "Release not found.",
      code: "NOT_FOUND",
    });
  }

  return await serialize(BottleReleaseSerializer, release, ctx.user);
});
