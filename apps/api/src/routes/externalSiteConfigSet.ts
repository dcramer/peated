import { db } from "@peated/server/db";
import { externalSiteConfig, externalSites } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../trpc";

export default adminProcedure
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      key: z.string(),
      value: z.any(),
    }),
  )
  .mutation(async function ({ input }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site));
    if (!site) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    await db
      .insert(externalSiteConfig)
      .values({
        externalSiteId: site.id,
        key: input.key,
        value: input.value,
      })
      .onConflictDoUpdate({
        target: [externalSiteConfig.externalSiteId, externalSiteConfig.key],
        set: {
          value: input.value,
        },
      });
  });
