import {
  AuditBottleInputSchema,
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

const IdSchema = z.number().int().positive();
const BottleIdSchema = z.object({ bottleId: IdSchema });
const EntityIdSchema = z.object({ entityId: IdSchema });

// Bottle checks own this rule: saved artifacts are read with loose objects that
// keep only the IDs, URLs, and field names that review needs. Classifier
// schemas change over time (fields removed, limits added), and a strict re-parse
// of an older check would block its review. New artifacts are strictly checked
// when the check is written.
export const SavedBottleCheckArtifactsSchema = z.object({
  extractedIdentity: z.record(z.string(), z.unknown()).nullish(),
  imageEvidence: z
    .object({
      fieldCandidates: z.record(z.string(), z.unknown()).optional(),
    })
    .nullish(),
  candidates: z
    .array(
      BottleIdSchema.extend({
        familyContext: z
          .object({ siblingBottles: z.array(BottleIdSchema).default([]) })
          .nullish(),
      }),
    )
    .default([]),
  bottleContexts: z
    .array(
      BottleIdSchema.extend({
        siblings: z.array(BottleIdSchema).default([]),
        shared: z.object({
          brand: EntityIdSchema,
          distillers: z.array(EntityIdSchema).default([]),
          bottler: EntityIdSchema.nullish(),
          series: z.object({ seriesId: IdSchema }).nullish(),
        }),
      }),
    )
    .default([]),
  entityContexts: z
    .array(
      EntityIdSchema.extend({
        relatedBottles: z.array(BottleIdSchema).default([]),
      }),
    )
    .default([]),
  resolvedEntities: z.array(EntityIdSchema).default([]),
  searchEvidence: z
    .array(
      z.object({ results: z.array(z.object({ url: z.string() })).default([]) }),
    )
    .default([]),
});

function persistedReferenceFields(
  inputSnapshot: BottleCheck["inputSnapshot"],
): PersistedBottleReferenceFields {
  return PersistedBottleReferenceSchema.parse(inputSnapshot).reference;
}

export function getPersistedBottleCheckSourceEvidencePaths(
  check: Pick<BottleCheck, "artifacts" | "inputSnapshot" | "intent">,
): string[] {
  const artifacts = SavedBottleCheckArtifactsSchema.parse(
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
