import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import type { ExternalSite } from "@peated/server/db/schema";
import { externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteInputSchema,
  ExternalSiteSchema,
  ExternalSiteTypeEnum,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";

export default procedure
  .use(requireAdmin)
  .route({ method: "PATCH", path: "/external-sites/:site" })
  .input(
    ExternalSiteInputSchema.partial().extend({
      site: ExternalSiteTypeEnum,
    }),
  )
  .output(ExternalSiteSchema)
  .handler(async function ({ input, context }) {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site));
    if (!site) {
      throw new ORPCError("NOT_FOUND", {
        message: "Site not found",
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
      return await serialize(ExternalSiteSerializer, site, context.user);
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
          throw new ORPCError("CONFLICT", {
            message: "Site with type already exists.",
            cause: err,
          });
        }
        throw err;
      }

      if (!newSite) return;

      return newSite;
    });

    if (!newSite) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update site.",
      });
    }

    return await serialize(ExternalSiteSerializer, newSite, context.user);
  });
