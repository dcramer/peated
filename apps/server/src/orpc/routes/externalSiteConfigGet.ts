import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { externalSiteConfig, externalSites } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAdmin } from "../middleware";

export default procedure
  .use(requireAdmin)
  .route({ method: "GET", path: "/external-sites/:site/config/:key" })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      key: z.string(),
      default: z.any().default(null),
    }),
  )
  .output(z.any())
  .handler(async function ({ input }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site));
    if (!site) {
      throw new ORPCError("NOT_FOUND", {
        message: "Site not found",
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
