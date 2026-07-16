import { z } from "zod";

export const ExactBottleMergePromotionEventSchema = z
  .object({
    sourceBottleId: z.number().int().positive(),
    sourceGroupId: z.number().int().positive(),
    destinationBottleId: z.number().int().positive(),
    destinationGroupId: z.number().int().positive(),
    actorId: z.number().int().positive(),
  })
  .strict();

export type ExactBottleMergePromotionEvent = z.infer<
  typeof ExactBottleMergePromotionEventSchema
>;

const ExactBottleMergePromotionHistorySchema = z.array(
  ExactBottleMergePromotionEventSchema,
);
const PromotionMetadataRecordSchema = z.record(z.string(), z.unknown());

function metadataRecord(metadata: unknown): Record<string, unknown> {
  const parsed = PromotionMetadataRecordSchema.safeParse(metadata);
  return parsed.success ? { ...parsed.data } : {};
}

function metadataRecordForAppend(metadata: unknown): Record<string, unknown> {
  if (metadata === null || metadata === undefined) return {};
  return { ...PromotionMetadataRecordSchema.parse(metadata) };
}

function historyForAppend(
  metadata: Record<string, unknown>,
): ExactBottleMergePromotionEvent[] {
  if (!Object.hasOwn(metadata, "exactBottleMerges")) return [];
  return ExactBottleMergePromotionHistorySchema.parse(
    metadata.exactBottleMerges,
  );
}

/** Reads only a wholly valid exact-merge history from durable unknown JSON. */
export function readExactBottleMergePromotionHistory(
  metadata: unknown,
): ExactBottleMergePromotionEvent[] {
  const record = metadataRecord(metadata);
  const parsed = ExactBottleMergePromotionHistorySchema.safeParse(
    record.exactBottleMerges,
  );
  return parsed.success ? parsed.data : [];
}

/** Preserves unrelated metadata and rejects corrupt existing merge history. */
export function appendExactBottleMergePromotionEvent(
  metadata: unknown,
  event: ExactBottleMergePromotionEvent,
): Record<string, unknown> {
  const record = metadataRecordForAppend(metadata);
  return {
    ...record,
    exactBottleMerges: [
      ...historyForAppend(record),
      ExactBottleMergePromotionEventSchema.parse(event),
    ],
  };
}
