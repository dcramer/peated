import type { CatalogVerificationFinding } from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import { bottles, entities } from "@peated/server/db/schema";
import { findBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import { getEntityClassificationReference } from "@peated/server/lib/entityAuditCandidates";
import { eq } from "drizzle-orm";

export async function getBottleCatalogVerificationFindings({
  bottleId,
}: {
  bottleId: number;
}): Promise<CatalogVerificationFinding[]> {
  const [bottle] = await db
    .select({
      id: bottles.id,
      brandId: bottles.brandId,
      fullName: bottles.fullName,
    })
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1);

  if (!bottle) {
    throw new Error(`Unknown bottle: ${bottleId}`);
  }

  const brandRepairResults = await findBrandRepairCandidates({
    currentBrandId: bottle.brandId ?? undefined,
    query: bottle.fullName,
  });

  const findings: CatalogVerificationFinding[] = [];

  const brandRepair = brandRepairResults.find(
    (candidate) => candidate.bottle.id === bottleId,
  );
  if (brandRepair) {
    findings.push({
      kind: "brand_repair_candidate",
      summary: `Bottle evidence points at ${brandRepair.targetBrand.name} instead of ${brandRepair.currentBrand.name}.`,
      details: brandRepair.supportingReferences
        .map((reference) => reference.text)
        .slice(0, 3)
        .join(" | "),
      workstream: "brand-repairs",
    });
  }

  return findings;
}

export async function getEntityCatalogVerificationFindings({
  entityId,
}: {
  entityId: number;
}): Promise<CatalogVerificationFinding[]> {
  const reference = await getEntityClassificationReference({
    entity: entityId,
    includeManualFallback: false,
  });

  if (!reference) {
    return [];
  }

  const candidateTargets = reference.candidateTargets
    .map((target) => target.name)
    .slice(0, 3);
  const targetSummary =
    candidateTargets.length > 0
      ? `Candidate targets: ${candidateTargets.join(", ")}.`
      : null;

  return [
    {
      kind: "entity_audit_candidate",
      summary:
        reference.reasons[0]?.summary ?? "Entity triggered audit signals.",
      details: [reference.reasons[0]?.details ?? null, targetSummary]
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
