import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import {
  ExternalSiteRunActiveError,
  queueManualExternalSiteRun,
} from "@peated/server/lib/externalSiteRuns";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteRunSchema,
  ExternalSiteTypeEnum,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteRunSerializer } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/external-sites/{site}/trigger",
    summary: "Trigger external site job",
    description:
      "Manually trigger a scraping job for an external site. Requires admin privileges",
    operationId: "triggerExternalSiteJob",
  })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
    }),
  )
  .output(ExternalSiteRunSchema)
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

    try {
      const run = await queueManualExternalSiteRun({
        site,
        requestedById: context.user.id,
      });
      return serialize(ExternalSiteRunSerializer, run, context.user);
    } catch (error) {
      if (error instanceof ExternalSiteRunActiveError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
