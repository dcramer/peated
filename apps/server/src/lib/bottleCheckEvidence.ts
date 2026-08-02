import {
  AuditBottleInputSchema,
  BottleClassificationArtifactsSchema,
  getBottleCheckSourceEvidencePaths,
  type BottleReference,
} from "@peated/bottle-classifier";
import type { BottleCheck } from "@peated/server/db/schema";

function persistedReferenceFields(
  inputSnapshot: Record<string, unknown>,
): Partial<Record<keyof BottleReference, unknown>> {
  const reference = inputSnapshot.reference;
  if (
    reference === null ||
    typeof reference !== "object" ||
    Array.isArray(reference)
  ) {
    throw new TypeError("Persisted Bottle check reference is invalid.");
  }

  const fields = reference as Record<string, unknown>;
  return {
    id: fields.id,
    externalSiteId: fields.externalSiteId,
    name: fields.name,
    url: fields.url,
    imageUrl: fields.imageUrl,
    currentBottleId: fields.currentBottleId,
  };
}

export function getPersistedBottleCheckSourceEvidencePaths(
  check: Pick<BottleCheck, "artifacts" | "inputSnapshot" | "intent">,
): string[] {
  const artifacts = BottleClassificationArtifactsSchema.parse(
    check.artifacts ?? {},
  );
  if (check.intent === "audit_bottle") {
    return getBottleCheckSourceEvidencePaths({
      intent: check.intent,
      input: AuditBottleInputSchema.parse(check.inputSnapshot),
      artifacts,
    });
  }

  return getBottleCheckSourceEvidencePaths({
    intent: check.intent,
    input: { reference: persistedReferenceFields(check.inputSnapshot) },
    artifacts,
  });
}
