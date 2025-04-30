import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { publicProcedure } from "../trpc";

export default publicProcedure
  .input(ExternalSiteTypeEnum)
  .query(async function ({ input, ctx }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input));
    if (!site) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }
    return await serialize(ExternalSiteSerializer, site, ctx.user);
  });
