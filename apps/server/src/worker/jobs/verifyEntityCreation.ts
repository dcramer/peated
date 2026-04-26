import {
  type CatalogVerificationCreationSource,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "@peated/catalog-verifier";
import { recordCatalogVerificationResult } from "@peated/server/lib/catalogVerification";
import {
  getCatalogVerificationDisplayName,
  getEntityCatalogVerificationFindings,
} from "@peated/server/lib/catalogVerificationFindings";

export default async function ({
  entityId,
  creationSource,
}: {
  entityId: number;
  creationSource: CatalogVerificationCreationSource;
}) {
  const displayName = await getCatalogVerificationDisplayName({
    objectId: entityId,
    objectType: "entity",
  });

  if (!shouldRunCatalogVerification(creationSource)) {
    await recordCatalogVerificationResult({
      displayName,
      objectId: entityId,
      objectType: "entity",
      result: {
        source: creationSource,
        status: "skipped",
        reason: getCatalogVerificationSkipReason(creationSource),
        findings: [],
      },
    });
    return;
  }

  const findings = await getEntityCatalogVerificationFindings({ entityId });

  await recordCatalogVerificationResult({
    displayName,
    objectId: entityId,
    objectType: "entity",
    result: {
      source: creationSource,
      status: findings.length > 0 ? "flagged" : "passed",
      reason: null,
      findings,
    },
  });
}
