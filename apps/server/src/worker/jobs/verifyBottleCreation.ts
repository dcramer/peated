import {
  type CatalogVerificationCreationSource,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "@peated/catalog-verifier";
import config from "@peated/server/config";
import { recordCatalogVerificationResult } from "@peated/server/lib/catalogVerification";
import {
  getBottleCatalogVerificationFindings,
  getCatalogVerificationDisplayName,
} from "@peated/server/lib/catalogVerificationFindings";

export default async function ({
  bottleId,
  creationSource,
}: {
  bottleId: number;
  creationSource: CatalogVerificationCreationSource;
}) {
  const displayName = await getCatalogVerificationDisplayName({
    objectId: bottleId,
    objectType: "bottle",
  });

  if (
    !shouldRunCatalogVerification(creationSource, {
      sampleKey: bottleId,
      sampleRate: config.CATALOG_VERIFICATION_AUTOMATION_SAMPLE_RATE,
    })
  ) {
    await recordCatalogVerificationResult({
      displayName,
      objectId: bottleId,
      objectType: "bottle",
      result: {
        source: creationSource,
        status: "skipped",
        reason: getCatalogVerificationSkipReason(creationSource),
        findings: [],
      },
    });
    return;
  }

  const findings = await getBottleCatalogVerificationFindings({ bottleId });

  await recordCatalogVerificationResult({
    displayName,
    objectId: bottleId,
    objectType: "bottle",
    result: {
      source: creationSource,
      status: findings.length > 0 ? "flagged" : "passed",
      reason: null,
      findings,
    },
  });
}
