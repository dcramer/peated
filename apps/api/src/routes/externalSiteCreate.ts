import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ExternalSiteInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "../trpc";

export default adminProcedure
  .input(ExternalSiteInputSchema)
  .mutation(async function ({ input, ctx }) {
    const site = await db.transaction(async (tx) => {
      try {
        const [site] = await tx.insert(externalSites).values(input).returning();
        return site;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "external_site_type") {
          throw new TRPCError({
            message: "Site with type already exists.",
            code: "CONFLICT",
            cause: err,
          });
        }
        throw err;
      }
    });

    if (!site) {
      throw new TRPCError({
        message: "Failed to create site.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(ExternalSiteSerializer, site, ctx.user);
  });
