import {
  AuditBottleInputSchema,
  BottleClassificationArtifactsSchema,
  getBottleCheckSourceEvidencePaths,
} from "@peated/bottle-classifier";
import type { BottleCheck } from "@peated/server/db/schema";
import { z } from "zod";

const PersistedBottleReferenceSchema = z.object({
  reference: z.object({
    id: z.unknown().optional(),
    externalSiteId: z.unknown().optional(),
    name: z.unknown().optional(),
    url: z.unknown().optional(),
    imageUrl: z.unknown().optional(),
    currentBottleId: z.unknown().optional(),
  }),
});
type PersistedBottleReferenceFields = z.infer<
  typeof PersistedBottleReferenceSchema
>["reference"];

function persistedReferenceFields(
  inputSnapshot: BottleCheck["inputSnapshot"],
): PersistedBottleReferenceFields {
  return PersistedBottleReferenceSchema.parse(inputSnapshot).reference;
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
