import {
  type CatalogVerificationCreationSource,
  type CatalogVerificationResult,
  buildCatalogVerificationCreationMetadata,
  buildCatalogVerificationResult,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "@peated/catalog-verifier";
import { logInfo } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/dispatch";

export function getCatalogVerificationCreationMetadata(
  creationSource: CatalogVerificationCreationSource,
) {
  return buildCatalogVerificationCreationMetadata(creationSource);
}

export async function queueBottleCreationVerification({
  bottleId,
  creationSource,
}: {
  bottleId: number;
  creationSource: CatalogVerificationCreationSource;
}) {
  const policyInput = {
    objectType: "bottle",
    source: creationSource,
  } as const;
  if (!shouldRunCatalogVerification(policyInput)) {
    logCatalogVerificationResult({
      objectId: bottleId,
      objectType: "bottle",
      result: {
        source: creationSource,
        status: "skipped",
        reason: getCatalogVerificationSkipReason(policyInput),
        findings: [],
      },
    });
    return;
  }

  await pushUniqueJob(
    "VerifyBottleCreation",
    {
      bottleId,
      creationSource,
    },
    { delay: 5000 },
  );
}

export async function queueEntityCreationVerification({
  entityId,
  creationSource,
}: {
  entityId: number;
  creationSource: CatalogVerificationCreationSource;
}) {
  const policyInput = {
    objectType: "entity",
    source: creationSource,
  } as const;
  if (!shouldRunCatalogVerification(policyInput)) {
    logCatalogVerificationResult({
      objectId: entityId,
      objectType: "entity",
      result: {
        source: creationSource,
        status: "skipped",
        reason: getCatalogVerificationSkipReason(policyInput),
        findings: [],
      },
    });
    return;
  }

  await pushUniqueJob(
    "VerifyEntityCreation",
    {
      entityId,
      creationSource,
    },
    { delay: 5000 },
  );
}

export function logCatalogVerificationResult({
  objectId,
  objectType,
  result,
}: {
  objectId: number;
  objectType: "bottle" | "entity";
  result: Omit<CatalogVerificationResult, "phase">;
}) {
  const verification = buildCatalogVerificationResult(result);

  logInfo("Catalog verification {status} for {objectType} {objectId}", {
    extra: {
      objectId,
      objectType,
      source: verification.source,
      status: verification.status,
      reason: verification.reason,
      findingCount: verification.findings.length,
      findingKinds: verification.findings.map(({ kind }) => kind),
      findingWorkstreams: Array.from(
        new Set(verification.findings.map(({ workstream }) => workstream)),
      ),
    },
  });
}
