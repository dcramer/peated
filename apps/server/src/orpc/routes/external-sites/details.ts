import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  ExternalSiteSchema,
  ExternalSiteTypeEnum,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/external-sites/:type" })
  .input(
    z.object({
      type: ExternalSiteTypeEnum,
    }),
  )
  .output(ExternalSiteSchema)
  .handler(async function ({ input, context, errors }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.type));
    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
      });
    }
    return await serialize(ExternalSiteSerializer, site, context.user);
  });
