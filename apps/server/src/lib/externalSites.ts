import {
  EXTERNAL_SITE_DEFINITIONS,
  isExternalReviewSiteKey,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSites,
} from "@peated/server/db/schema";
import { ExternalSiteKeySchema } from "@peated/server/schemas/externalSites";
import type { ExternalSiteKey } from "@peated/server/types";

export class ExternalSiteNotFoundError extends Error {
  constructor(readonly site: ExternalSiteKey) {
    super(`External site not found: ${site}`);
    this.name = "ExternalSiteNotFoundError";
  }
}

/** Keeps durable foreign-key rows aligned with the code-owned scraper list. */
export async function syncExternalSites() {
  await db.transaction(async (tx) => {
    for (const [key, definition] of Object.entries(EXTERNAL_SITE_DEFINITIONS)) {
      const siteKey = ExternalSiteKeySchema.parse(key);
      const [site] = await tx
        .insert(externalSites)
        .values({
          type: siteKey,
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

      if (site && isExternalReviewSiteKey(siteKey)) {
        await tx
          .insert(externalReviewSourcePolicies)
          .values({ externalSiteId: site.id })
          .onConflictDoNothing();
      }
    }
  });
}
