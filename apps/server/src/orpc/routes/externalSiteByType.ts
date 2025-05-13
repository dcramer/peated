import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "GET", path: "/external-sites/:type" })
  .input(
    z.object({
      type: ExternalSiteTypeEnum,
    }),
  )
  .output(z.any())
  .handler(async function ({ input, context }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.type));
    if (!site) {
      throw new ORPCError("NOT_FOUND", {
        message: "External site not found",
      });
    }
    return await serialize(ExternalSiteSerializer, site, context.user);
  });
