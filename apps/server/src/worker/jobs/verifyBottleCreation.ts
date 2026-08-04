import {
  CatalogVerificationCreationSourceEnum,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "@peated/catalog-verifier";
import { runPostUserCreationBottleAudit } from "@peated/server/agents/bottleClassifier/auditBottle";
import { recordCatalogVerificationResult } from "@peated/server/lib/catalogVerification";
import { getCatalogVerificationDisplayName } from "@peated/server/lib/catalogVerificationFindings";
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

  if (!shouldRunCatalogVerification(creationSource)) {
    const displayName = await getCatalogVerificationDisplayName({
      objectId: bottleId,
      objectType: "bottle",
    });
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

  await runPostUserCreationBottleAudit({
    bottleId,
    backgroundEventKey: getBottleCreationEventKey(bottleId),
  });
}
