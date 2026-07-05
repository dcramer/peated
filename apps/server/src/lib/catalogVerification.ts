import {
  type CatalogVerificationCreationSource,
  type CatalogVerificationResult,
  buildCatalogVerificationCreationMetadata,
  buildCatalogVerificationResult,
} from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { pushUniqueJob } from "@peated/server/worker/client";

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
  await pushUniqueJob(
    "VerifyEntityCreation",
    {
      entityId,
      creationSource,
    },
    { delay: 5000 },
  );
}

export async function recordCatalogVerificationResult({
  displayName,
  objectId,
  objectType,
  result,
}: {
  displayName: string;
  objectId: number;
  objectType: "bottle" | "entity";
  result: Omit<CatalogVerificationResult, "phase">;
}) {
  const actor = await getPeatedSystemActor();

  await db.insert(changes).values({
    objectType,
    objectId,
    displayName,
    type: "update",
    actorId: actor.id,
    data: {
      catalogVerification: buildCatalogVerificationResult(result),
    },
  });
}
