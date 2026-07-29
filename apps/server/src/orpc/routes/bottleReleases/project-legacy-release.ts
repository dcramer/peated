import type { BottleReleaseSchema, BottleSchema } from "@peated/server/schemas";
import type { z } from "zod";

type LegacyReleaseReference = {
  id: number;
  bottleId: number;
};

/**
 * Keeps the staged BottleRelease response shape while delegating every
 * non-locator field to the canonical exact Bottle representation.
 */
export function projectLegacyBottleRelease(
  release: LegacyReleaseReference,
  bottle: z.infer<typeof BottleSchema>,
): z.infer<typeof BottleReleaseSchema> {
  return {
    id: release.id,
    bottleId: release.bottleId,
    fullName: bottle.fullName,
    name: bottle.name,
    edition: bottle.edition,
    statedAge: bottle.statedAge,
    abv: bottle.abv,
    caskStrength: bottle.caskStrength,
    singleCask: bottle.singleCask,
    vintageYear: bottle.vintageYear,
    releaseYear: bottle.releaseYear,
    caskType: bottle.caskType,
    caskSize: bottle.caskSize,
    caskFill: bottle.caskFill,
    description: bottle.description,
    tastingNotes: bottle.tastingNotes ?? null,
    imageUrl: bottle.imageUrl,
    avgRating: bottle.avgRating,
    totalTastings: bottle.totalTastings,
    suggestedTags: bottle.suggestedTags ?? [],
    isFavorite: bottle.isFavorite,
    hasTasted: bottle.hasTasted,
    createdAt: bottle.createdAt,
    updatedAt: bottle.updatedAt,
  };
}
