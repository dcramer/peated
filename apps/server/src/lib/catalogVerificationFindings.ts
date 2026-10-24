import type { CatalogVerificationFinding } from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import { bottles, entities } from "@peated/server/db/schema";
import { findBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import { getEntityClassificationContext } from "@peated/server/lib/entityAuditCandidates";
import { eq } from "drizzle-orm";

export async function getEntityCatalogVerificationFindings({
  entityId,
}: {
  entityId: number;
}): Promise<CatalogVerificationFinding[]> {
  const context = await getEntityClassificationContext({
    entity: entityId,
    includeManualFallback: false,
  });

  if (!context) {
    return [];
  }

  const candidateTargets = context.candidateTargets
    .map((target) => target.name)
    .slice(0, 3);
  const targetSummary =
    candidateTargets.length > 0
      ? `Candidate targets: ${candidateTargets.join(", ")}.`
      : null;

  return [
    {
      kind: "entity_audit_candidate",
      summary: context.reasons[0]?.summary ?? "Entity triggered audit signals.",
      details: [context.reasons[0]?.details ?? null, targetSummary]
        .filter(Boolean)
        .join(" "),
      workstream: "entity-audits",
    },
  ];
}

export async function getCatalogVerificationDisplayName({
  objectId,
  objectType,
}: {
  objectId: number;
  objectType: "bottle" | "entity";
}) {
  if (objectType === "bottle") {
    const [bottle] = await db
      .select({
        displayName: bottles.fullName,
      })
      .from(bottles)
      .where(eq(bottles.id, objectId))
      .limit(1);

    if (!bottle) return null;

    return bottle.displayName;
  }

  const [entity] = await db
    .select({
      displayName: entities.name,
    })
    .from(entities)
    .where(eq(entities.id, objectId))
    .limit(1);

  if (!entity) return null;

  return entity.displayName;
}
