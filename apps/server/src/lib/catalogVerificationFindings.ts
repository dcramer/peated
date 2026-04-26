import type { CatalogVerificationFinding } from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import { bottles, entities } from "@peated/server/db/schema";
import { findBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import { getCanonRepairCandidates } from "@peated/server/lib/canonRepairCandidates";
import { getDirtyParentAgeRepairCandidates } from "@peated/server/lib/dirtyParentAgeRepairCandidates";
import { getEntityClassificationReference } from "@peated/server/lib/entityAuditCandidates";
import { getLegacyReleaseRepairCandidates } from "@peated/server/lib/legacyReleaseRepairCandidates";
import { eq } from "drizzle-orm";

const EXACT_LOOKUP_LIMIT = 100;

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

  const [
    brandRepairResults,
    canonRepairResults,
    releaseRepairResults,
    ageRepairResults,
  ] = await Promise.all([
    findBrandRepairCandidates({
      currentBrandId: bottle.brandId ?? undefined,
      query: bottle.fullName,
    }),
    getCanonRepairCandidates({
      query: bottle.fullName,
      cursor: 1,
      limit: EXACT_LOOKUP_LIMIT,
    }),
    getLegacyReleaseRepairCandidates({
      query: bottle.fullName,
      cursor: 1,
      limit: EXACT_LOOKUP_LIMIT,
    }),
    getDirtyParentAgeRepairCandidates({
      query: bottle.fullName,
      cursor: 1,
      limit: EXACT_LOOKUP_LIMIT,
    }),
  ]);

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

  const canonRepair = canonRepairResults.results.find(
    (candidate) => candidate.bottle.id === bottleId,
  );
  if (canonRepair) {
    findings.push({
      kind: "canon_repair_candidate",
      summary: `Bottle looks like a wording variant of ${canonRepair.targetBottle.fullName}.`,
      details: null,
      workstream: "canon-repairs",
    });
  }

  const releaseRepair = releaseRepairResults.results.find(
    (candidate) => candidate.legacyBottle.id === bottleId,
  );
  if (releaseRepair) {
    findings.push({
      kind: "release_repair_candidate",
      summary:
        "Bottle name still carries release-level identity and likely needs a parent/release split.",
      details: releaseRepair.proposedParent.fullName,
      workstream: "release-repairs",
    });
  }

  const ageRepair = ageRepairResults.results.find(
    (candidate) => candidate.bottle.id === bottleId,
  );
  if (ageRepair) {
    findings.push({
      kind: "age_repair_candidate",
      summary:
        "Bottle-level stated age conflicts with child releases and should move onto a release record.",
      details: ageRepair.targetRelease.fullName,
      workstream: "age-repairs",
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

    if (!bottle) {
      throw new Error(`Unknown bottle: ${objectId}`);
    }

    return bottle.displayName;
  }

  const [entity] = await db
    .select({
      displayName: entities.name,
    })
    .from(entities)
    .where(eq(entities.id, objectId))
    .limit(1);

  if (!entity) {
    throw new Error(`Unknown entity: ${objectId}`);
  }

  return entity.displayName;
}
