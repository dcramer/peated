import type { AnyDatabase } from "@peated/server/db";
import { bottleObservations } from "@peated/server/db/schema";
import { sql } from "drizzle-orm";

type BottleObservationUpsertInput = {
  bottleId: number;
  releaseId?: number | null;
  sourceType: "store_price" | "manual" | "import" | "other";
  sourceKey: string;
  sourceName: string;
  sourceUrl?: string | null;
  externalSiteId?: number | null;
  rawText?: string | null;
  parsedIdentity?: Record<string, unknown> | null;
  facts?: Record<string, unknown> | null;
  createdById?: number | null;
};

export async function upsertBottleObservationInTransaction(
  tx: AnyDatabase,
  {
    bottleId,
    releaseId = null,
    sourceType,
    sourceKey,
    sourceName,
    sourceUrl = null,
    externalSiteId = null,
    rawText = null,
    parsedIdentity = null,
    facts = null,
    createdById = null,
  }: BottleObservationUpsertInput,
) {
  const [observation] = await tx
    .insert(bottleObservations)
    .values({
      bottleId,
      releaseId,
      sourceType,
      sourceKey,
      sourceName,
      sourceUrl,
      externalSiteId,
      rawText,
      parsedIdentity,
      facts,
      createdById,
    })
    .onConflictDoUpdate({
      target: [bottleObservations.sourceType, bottleObservations.sourceKey],
      set: {
        bottleId,
        releaseId,
        sourceName,
        sourceUrl,
        externalSiteId,
        rawText,
        parsedIdentity,
        facts,
        createdById:
          createdById === null
            ? sql`${bottleObservations.createdById}`
            : createdById,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();

  return observation;
}
