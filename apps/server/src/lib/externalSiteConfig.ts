import { db } from "@peated/server/db";
import { externalSiteConfig, externalSites } from "@peated/server/db/schema";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import type { ExternalSiteType } from "@peated/server/types";
import { and, eq } from "drizzle-orm";

/** Owns opaque per-site scraper checkpoints shared by API and worker callers. */

export async function getExternalSiteConfig({
  site: siteType,
  key,
  defaultValue = null,
}: {
  site: ExternalSiteType;
  key: string;
  defaultValue?: unknown;
}) {
  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, siteType));
  if (!site) throw new ExternalSiteNotFoundError(siteType);

  const [result] = await db
    .select({ value: externalSiteConfig.value })
    .from(externalSiteConfig)
    .where(
      and(
        eq(externalSiteConfig.externalSiteId, site.id),
        eq(externalSiteConfig.key, key),
      ),
    );

  return result?.value ?? defaultValue;
}

export async function setExternalSiteConfig({
  site: siteType,
  key,
  value,
}: {
  site: ExternalSiteType;
  key: string;
  value: unknown;
}) {
  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, siteType));
  if (!site) throw new ExternalSiteNotFoundError(siteType);

  await db
    .insert(externalSiteConfig)
    .values({
      externalSiteId: site.id,
      key,
      value,
    })
    .onConflictDoUpdate({
      target: [externalSiteConfig.externalSiteId, externalSiteConfig.key],
      set: { value },
    });
}
