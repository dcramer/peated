import { db } from "@peated/server/db";
import { externalSiteConfig, externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({ method: "PUT", path: "/external-sites/:site/config/:key" })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      key: z.string(),
      value: z.any(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site));
    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
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

    return {};
  });
