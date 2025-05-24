import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteInputSchema,
  ExternalSiteSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";

export default procedure
  .use(requireAdmin)
  .route({ method: "POST", path: "/external-sites" })
  .input(ExternalSiteInputSchema)
  .output(ExternalSiteSchema)
  .handler(async function ({ input, context, errors }) {
    const site = await db.transaction(async (tx) => {
      try {
        const [site] = await tx.insert(externalSites).values(input).returning();
        return site;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "external_site_type") {
          throw errors.CONFLICT({
            message: "Site with type already exists.",
            cause: err,
          });
        }
        throw err;
      }
    });

    if (!site) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create site.",
      });
    }

    return await serialize(ExternalSiteSerializer, site, context.user);
  });
