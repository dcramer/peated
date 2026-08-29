import { isExternalReviewSiteKey } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSites,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ExternalReviewSourcePolicySchema,
  ExternalSiteKeySchema,
} from "@peated/server/schemas";
import { serializeExternalReviewSourcePolicy } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/external-sites/{site}/review-policy",
    summary: "Retrieve external review source policy",
    operationId: "retrieveExternalReviewSourcePolicy",
  })
  .input(z.object({ site: ExternalSiteKeySchema }).strict())
  .output(ExternalReviewSourcePolicySchema)
  .handler(async ({ input, errors }) => {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

    const policy = await db.query.externalReviewSourcePolicies.findFirst({
      where: eq(externalReviewSourcePolicies.externalSiteId, site.id),
    });
    if (!policy && !isExternalReviewSiteKey(input.site)) {
      throw errors.NOT_FOUND({ message: "Review source not found." });
    }

    return serializeExternalReviewSourcePolicy(site.id, policy ?? null);
  });
