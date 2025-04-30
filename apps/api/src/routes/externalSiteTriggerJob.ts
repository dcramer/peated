import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import { pushJob } from "@peated/server/worker/client";
import { getJobForSite } from "@peated/server/worker/utils";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { adminProcedure } from "../trpc";

export default adminProcedure
  .input(ExternalSiteTypeEnum)
  .mutation(async function ({ input, ctx }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input));
    if (!site) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    await pushJob(getJobForSite(site.type));

    await db
      .update(externalSites)
      .set({
        lastRunAt: sql`NOW()`,
        nextRunAt: site.runEvery
          ? sql`NOW() + INTERVAL '${sql.raw(`${site.runEvery} minutes`)}'`
          : null,
      })
      .where(eq(externalSites.id, site.id));

    // fake the updates
    site.lastRunAt = new Date();
    if (site.runEvery) {
      const d = new Date(site.lastRunAt);
      d.setMinutes(d.getMinutes() + site.runEvery);
      site.nextRunAt = d;
    }

    return await serialize(ExternalSiteSerializer, site, ctx.user);
  });
