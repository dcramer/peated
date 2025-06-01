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
  .route({
    method: "GET",
    path: "/external-sites/{site}",
    summary: "Get external site details",
    description:
      "Retrieve detailed information about a specific external site by its type",
  })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
    })
  )
  .output(ExternalSiteSchema)
  .handler(async ({ input, context, errors }) => {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site));
    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
      });
    }
    return await serialize(ExternalSiteSerializer, site, context.user);
  });
