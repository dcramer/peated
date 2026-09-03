import { isExternalReviewSiteKey } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewPublications,
  externalSites,
} from "@peated/server/db/schema";
import { loadReviewScoringSettings } from "@peated/server/externalReviews/scoringSettings";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ExternalReviewScoringSettingsSchema,
  ExternalSiteKeySchema,
} from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/external-sites/{site}/review-scoring",
    summary: "Get review score settings",
    description:
      "Get a site's saved score table and whether bottle scores are still updating. Requires moderator privileges.",
    operationId: "getExternalReviewScoring",
  })
  .input(z.object({ site: ExternalSiteKeySchema }).strict())
  .output(ExternalReviewScoringSettingsSchema)
  .handler(async ({ input, errors }) => {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });
    const publication = await db.query.externalReviewPublications.findFirst({
      where: eq(externalReviewPublications.externalSiteId, site.id),
    });
    if (!publication && !isExternalReviewSiteKey(site.type))
      throw errors.NOT_FOUND({ message: "Review source not found." });
    return (
      (await loadReviewScoringSettings([site.id])).get(site.id) ?? {
        version: 0,
        policy: null,
        recomputePending: false,
      }
    );
  });
