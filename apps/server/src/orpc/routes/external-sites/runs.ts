import { db } from "@peated/server/db";
import { externalSiteRuns, externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteRunSchema,
  ExternalSiteTypeEnum,
  listResponse,
} from "@peated/server/schemas";
import { serializeExternalSiteRun } from "@peated/server/serializers/externalSite";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/external-sites/{site}/runs",
    summary: "List recent external site runs",
    operationId: "listExternalSiteRuns",
  })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(20),
    }),
  )
  .output(listResponse(ExternalSiteRunSchema))
  .handler(async ({ input, errors }) => {
    const [site] = await db
      .select({ id: externalSites.id })
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

    const results = await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.externalSiteId, site.id))
      .orderBy(desc(externalSiteRuns.createdAt))
      .limit(input.limit + 1)
      .offset((input.cursor - 1) * input.limit);
    return {
      results: results.slice(0, input.limit).map(serializeExternalSiteRun),
      rel: {
        nextCursor: results.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
