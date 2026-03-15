import {
  normalizeBottle,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/server/lib/normalize";
import type { ProposedBottleSchema } from "@peated/server/schemas";
import type { z } from "zod";

type ProposedBottle = z.infer<typeof ProposedBottleSchema>;

export function normalizeProposedBottleDraft(
  proposedBottle: ProposedBottle,
): ProposedBottle {
  const normalized = normalizeBottle({
    name: stripDuplicateBrandPrefixFromBottleName(
      proposedBottle.name,
      proposedBottle.brand.name,
    ),
    statedAge: proposedBottle.statedAge,
    vintageYear: proposedBottle.vintageYear,
    releaseYear: proposedBottle.releaseYear,
    caskStrength: proposedBottle.caskStrength,
    singleCask: proposedBottle.singleCask,
    isFullName: false,
  });

  return {
    ...proposedBottle,
    name: normalized.name,
    statedAge: normalized.statedAge,
    vintageYear: normalized.vintageYear,
    releaseYear: normalized.releaseYear,
    caskStrength: normalized.caskStrength ?? null,
    singleCask: normalized.singleCask ?? null,
  };
}
