import { db } from "@peated/server/db";
import {
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
} from "@peated/server/db/schema";
import { logWarn } from "@peated/server/lib/log";
import {
  downloadSiteIcon,
  SITE_ICON_NOT_FOUND_MESSAGE,
} from "@peated/server/lib/siteIcon";
import { deleteFile, storeFile } from "@peated/server/lib/uploads";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteKeySchema,
  ExternalSiteSchema,
} from "@peated/server/schemas";
import { serializeExternalSite } from "@peated/server/serializers/externalSite";
import { and, eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { z } from "zod";

const InputSchema = z.object({ site: ExternalSiteKeySchema }).strict();

function ownedIconFilename(imageUrl: string | null) {
  if (!imageUrl) return null;
  const pathname = new URL(imageUrl, "https://peated.invalid").pathname;
  const prefix = "/uploads/external-sites/";
  return pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice("/uploads/".length))
    : null;
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/external-sites/{site}/icon",
    summary: "Find and store an external site icon",
    operationId: "captureExternalSiteIcon",
  })
  .input(InputSchema)
  .output(ExternalSiteSchema)
  .handler(async ({ input, errors }) => {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

    const rows = await db
      .select({ origin: scrapeOrigins.origin })
      .from(externalSiteScrapeTargets)
      .innerJoin(
        scrapeOrigins,
        eq(scrapeOrigins.targetKey, externalSiteScrapeTargets.targetKey),
      )
      .where(
        and(
          eq(externalSiteScrapeTargets.externalSiteId, site.id),
          eq(externalSiteScrapeTargets.active, true),
          eq(scrapeOrigins.active, true),
        ),
      );
    if (rows.length === 0) {
      throw errors.BAD_REQUEST({
        message: "This scraper has no website to check.",
      });
    }

    let icon: Awaited<ReturnType<typeof downloadSiteIcon>> | null = null;
    for (const row of rows) {
      try {
        icon = await downloadSiteIcon(new URL(row.origin));
        break;
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        // A scraper can have API and website origins; try each active website.
      }
    }
    if (!icon) {
      throw errors.BAD_REQUEST({
        message: SITE_ICON_NOT_FOUND_MESSAGE,
      });
    }

    const imageUrl = await storeFile({
      data: {
        file: Readable.from(icon.data),
        filename: "site-icon",
      },
      directory: "external-sites",
      namespace: `site-icon-${site.type}`,
      onProcess: (stream, filename) => ({
        filename: `${filename}.webp`,
        stream,
      }),
      urlPrefix: "/uploads",
    });
    let updated: typeof site | undefined;
    try {
      [updated] = await db
        .update(externalSites)
        .set({ imageUrl })
        .where(eq(externalSites.id, site.id))
        .returning();
    } catch (error) {
      await deleteFile({
        filename: decodeURIComponent(imageUrl.slice("/uploads/".length)),
      });
      throw error;
    }
    if (!updated) {
      await deleteFile({
        filename: decodeURIComponent(imageUrl.slice("/uploads/".length)),
      });
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to save the site icon.",
      });
    }

    const oldFilename = ownedIconFilename(site.imageUrl);
    if (oldFilename) {
      try {
        await deleteFile({ filename: oldFilename });
      } catch {
        // The new icon is durable; stale-file cleanup must not undo the update.
        logWarn("Failed to delete the previous external site icon", {
          extra: { externalSiteId: site.id },
        });
      }
    }
    return serializeExternalSite(updated);
  });
