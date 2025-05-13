import { db } from "@peated/server/db";
import { externalSiteConfig, externalSites } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";

export default adminProcedure
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      key: z.string(),
      default: z.any().default(null),
    }),
  )
  .query(async function ({ input }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site));
    if (!site) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    const [result] = await db
      .select({ value: externalSiteConfig.value })
      .from(externalSiteConfig)
      .where(
        and(
          eq(externalSiteConfig.externalSiteId, site.id),
          eq(externalSiteConfig.key, input.key),
        ),
      );

    return result?.value ?? input.default;
  });
