import { isExternalReviewSiteType } from "@peated/server/constants";
import type { AnyDatabase } from "@peated/server/db";
import { externalReviewSourcePolicies } from "@peated/server/db/schema";
import type { ExternalSiteType } from "@peated/server/types";
import { eq } from "drizzle-orm";

export type ExternalReviewSourceCapability =
  | "allowFetching"
  | "allowLlmProcessing"
  | "allowScoreDisplay"
  | "allowSummaryDisplay";

export class ExternalReviewSourcePolicyError extends Error {
  constructor(
    readonly siteType: ExternalSiteType,
    readonly capability: ExternalReviewSourceCapability,
  ) {
    super(
      `External review source ${siteType} is not approved for ${capability}.`,
    );
  }
}

/**
 * This is the runtime authorization boundary for publisher content. Callers
 * must still honor robots.txt; robots permission never grants a capability.
 */
export async function requireExternalReviewSourceCapability(
  connection: AnyDatabase,
  site: { id: number; type: ExternalSiteType },
  capability: ExternalReviewSourceCapability,
) {
  const [policy] = await connection
    .select()
    .from(externalReviewSourcePolicies)
    .where(eq(externalReviewSourcePolicies.externalSiteId, site.id))
    .limit(1);

  if (!policy || policy.publicationMode === "disabled" || !policy[capability]) {
    throw new ExternalReviewSourcePolicyError(site.type, capability);
  }
}

/** Refuses review-source runs before they create durable queue work. */
export async function requireExternalReviewFetchBeforeQueue(
  connection: AnyDatabase,
  site: { id: number; type: ExternalSiteType },
) {
  if (!isExternalReviewSiteType(site.type)) return;
  await requireExternalReviewSourceCapability(
    connection,
    site,
    "allowFetching",
  );
}
