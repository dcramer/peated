import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { pushJob } from "@peated/server/worker/client";
import { getJobForSite } from "@peated/server/worker/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAdmin } from "../middleware";

export default procedure
  .use(requireAdmin)
  .route({ method: "POST", path: "/external-sites/:site/trigger" })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async function ({ input, context }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);

    if (!site) {
      throw new ORPCError("NOT_FOUND", {
        message: "External site not found",
      });
    }

    await pushJob(getJobForSite(site.type));

    return {
      success: true,
    };
  });
