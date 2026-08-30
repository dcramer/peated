import { isExternalReviewSiteKey } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewPublications,
  externalSites,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ExternalReviewPublicationSchema,
  ExternalSiteKeySchema,
} from "@peated/server/schemas";
import { serializeExternalReviewPublication } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/external-sites/{site}/review-publication",
    summary: "Retrieve external review publication",
    operationId: "retrieveExternalReviewPublication",
  })
  .input(z.object({ site: ExternalSiteKeySchema }).strict())
  .output(ExternalReviewPublicationSchema)
  .handler(async ({ input, errors }) => {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

    const publication = await db.query.externalReviewPublications.findFirst({
      where: eq(externalReviewPublications.externalSiteId, site.id),
    });
    if (!publication && !isExternalReviewSiteKey(input.site)) {
      throw errors.NOT_FOUND({ message: "Review source not found." });
    }

    return serializeExternalReviewPublication(site.id, publication ?? null);
  });
