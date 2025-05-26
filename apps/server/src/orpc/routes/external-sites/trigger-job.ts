import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { pushJob } from "@peated/server/worker/client";
import { getJobForSite } from "@peated/server/worker/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({ method: "POST", path: "/external-sites/{site}/trigger" })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async function ({ input, context, errors }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);

    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
      });
    }

    await pushJob(getJobForSite(site.type));

    return {
      success: true,
    };
  });
