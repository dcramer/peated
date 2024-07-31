import { db } from "@peated/server/db";
import type { ExternalSite } from "@peated/server/db/schema";
import { externalSites } from "@peated/server/db/schema";
import {
  ExternalSiteInputSchema,
  ExternalSiteTypeEnum,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { adminProcedure } from "..";

export default adminProcedure
  .input(
    ExternalSiteInputSchema.partial().extend({
      site: ExternalSiteTypeEnum,
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site));
    if (!site) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.name && input.name !== site.name) {
      data.name = input.name;
    }
    if (input.type && input.type !== site.type) {
      data.type = input.type;
    }
    if (input.runEvery !== undefined && input.runEvery !== site.runEvery) {
      data.runEvery = input.runEvery;
    }
    if (Object.values(data).length === 0) {
      return await serialize(ExternalSiteSerializer, site, ctx.user);
    }
    const newSite = await db.transaction(async (tx) => {
      let newSite: ExternalSite | undefined;
      try {
        [newSite] = await tx
          .update(externalSites)
          .set(data)
          .where(eq(externalSites.id, site.id))
          .returning();
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

      if (!newSite) return;

      return newSite;
    });

    if (!newSite) {
      throw new TRPCError({
        message: "Failed to update site.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(ExternalSiteSerializer, newSite, ctx.user);
  });
