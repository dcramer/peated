import {
  CatalogVerificationCreationSourceEnum,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "@peated/catalog-verifier";
import { runPostUserCreationBottleAudit } from "@peated/server/agents/bottleClassifier/auditBottle";
import config from "@peated/server/config";
import { recordCatalogVerificationResult } from "@peated/server/lib/catalogVerification";
import {
  getBottleCatalogVerificationFindings,
  getCatalogVerificationDisplayName,
} from "@peated/server/lib/catalogVerificationFindings";
import { z } from "zod";

export const VerifyBottleCreationJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
    creationSource: z.enum(CatalogVerificationCreationSourceEnum.options),
  })
  .strict();

export type VerifyBottleCreationJobArgs = z.infer<
  typeof VerifyBottleCreationJobArgsSchema
>;

function getBottleCreationEventKey(bottleId: number) {
  return `bottle_created:${bottleId}`;
}

export default async function verifyBottleCreation(input: unknown) {
  const { bottleId, creationSource } =
    VerifyBottleCreationJobArgsSchema.parse(input);

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

  if (config.BOTTLE_CHECK_SHADOW_GENERATION) {
    await runPostUserCreationBottleAudit({
      bottleId,
      backgroundEventKey: getBottleCreationEventKey(bottleId),
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
