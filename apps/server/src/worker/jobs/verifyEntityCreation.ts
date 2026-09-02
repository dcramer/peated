import {
  CatalogVerificationCreationSourceEnum,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "@peated/catalog-verifier";
import { recordCatalogVerificationResult } from "@peated/server/lib/catalogVerification";
import {
  getCatalogVerificationDisplayName,
  getEntityCatalogVerificationFindings,
} from "@peated/server/lib/catalogVerificationFindings";
import type { JobPayload } from "@peated/server/worker/types";
import { z } from "zod";

export const VerifyEntityCreationJobArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
    creationSource: z.enum(CatalogVerificationCreationSourceEnum.options),
  })
  .strict();

export default async function verifyEntityCreation(input: JobPayload) {
  const { entityId, creationSource } =
    VerifyEntityCreationJobArgsSchema.parse(input);

  const displayName = await getCatalogVerificationDisplayName({
    objectId: entityId,
    objectType: "entity",
  });
  if (!displayName) return;

  const policyInput = { objectType: "entity", source: creationSource } as const;

  if (!shouldRunCatalogVerification(policyInput)) {
    await recordCatalogVerificationResult({
      displayName,
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
