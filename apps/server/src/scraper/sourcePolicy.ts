import type { AnyDatabase } from "@peated/server/db";
import { externalReviewSourcePolicies } from "@peated/server/db/schema";
import type { ExternalSiteType } from "@peated/server/types";
import { eq } from "drizzle-orm";

export type ExternalReviewSourceCapability =
  | "allowLlmProcessing"
  | "allowScoreDisplay"
  | "allowSummaryDisplay";

export class ExternalReviewSourcePolicyError extends Error {
  constructor(
    readonly siteType: ExternalSiteType,
    readonly capability: ExternalReviewSourceCapability,
  ) {
    super(`External review source ${siteType} does not enable ${capability}.`);
  }
}

/** This is the runtime boundary for processing and displaying publisher content. */
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
