import {
  CatalogVerificationCreationSourceEnum,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "@peated/catalog-verifier";
import { runPostUserCreationBottleAudit } from "@peated/server/agents/bottleClassifier/auditBottle";
import { recordCatalogVerificationResult } from "@peated/server/lib/catalogVerification";
import { getCatalogVerificationDisplayName } from "@peated/server/lib/catalogVerificationFindings";
import { z } from "zod";
import type { JobPayload } from "../types";

export const VerifyBottleCreationJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
    creationSource: z.enum(CatalogVerificationCreationSourceEnum.options),
  })
  .strict();

export type VerifyBottleCreationJobArgs = z.infer<
  typeof VerifyBottleCreationJobArgsSchema
>;

export type VerifyBottleCreationServices = {
  runAudit: NonNullable<Parameters<typeof runPostUserCreationBottleAudit>[1]>;
};

function getBottleCreationEventKey(bottleId: number) {
  return `bottle_created:${bottleId}`;
}

export async function verifyBottleCreation(
  input: JobPayload,
  services?: VerifyBottleCreationServices,
) {
  const { bottleId, creationSource } =
    VerifyBottleCreationJobArgsSchema.parse(input);

  const policyInput = { objectType: "bottle", source: creationSource } as const;

  if (!shouldRunCatalogVerification(policyInput)) {
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
        reason: getCatalogVerificationSkipReason(policyInput),
        findings: [],
      },
    });
    return;
  }

  await runPostUserCreationBottleAudit(
    {
      bottleId,
      backgroundEventKey: getBottleCreationEventKey(bottleId),
    },
    services?.runAudit,
  );
}

export default async function verifyBottleCreationJob(input: JobPayload) {
  return await verifyBottleCreation(input);
}
