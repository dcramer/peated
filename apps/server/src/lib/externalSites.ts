import {
  EXTERNAL_SITE_DEFINITIONS,
  isExternalReviewSiteType,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSites,
} from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas/externalSites";
import type { ExternalSiteType } from "@peated/server/types";

export class ExternalSiteNotFoundError extends Error {
  constructor(readonly site: ExternalSiteType) {
    super(`External site not found: ${site}`);
    this.name = "ExternalSiteNotFoundError";
  }
}

/** Keeps durable foreign-key rows aligned with the code-owned scraper list. */
export async function syncExternalSites() {
  await db.transaction(async (tx) => {
    for (const [type, definition] of Object.entries(
      EXTERNAL_SITE_DEFINITIONS,
    )) {
      const siteType = ExternalSiteTypeEnum.parse(type);
      const [site] = await tx
        .insert(externalSites)
        .values({
          type: siteType,
          name: definition.name,
          runEvery: definition.runEvery,
        })
        .onConflictDoUpdate({
          target: externalSites.type,
          set: {
            name: definition.name,
            runEvery: definition.runEvery,
          },
        })
        .returning({ id: externalSites.id });

      if (site && isExternalReviewSiteType(siteType)) {
        await tx
          .insert(externalReviewSourcePolicies)
          .values({ externalSiteId: site.id })
          .onConflictDoNothing();
      }
    }
  });
}
