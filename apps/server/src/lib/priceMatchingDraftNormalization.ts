import {
  normalizeBottle,
  normalizeString,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/server/lib/normalize";
import type { ProposedBottleSchema } from "@peated/server/schemas";
import type { z } from "zod";

type ProposedBottle = z.infer<typeof ProposedBottleSchema>;

export function normalizeProposedBottleDraft(
  proposedBottle: ProposedBottle,
): ProposedBottle {
  const normalizedBrandName = normalizeString(
    proposedBottle.brand.name,
  ).toLowerCase();
  const distillersByName = new Map<
    string,
    ProposedBottle["distillers"][number]
  >();
  for (const distiller of proposedBottle.distillers) {
    const normalizedDistillerName = normalizeString(
      distiller.name,
    ).toLowerCase();
    if (!normalizedDistillerName) {
      continue;
    }

    const existing = distillersByName.get(normalizedDistillerName);
    if (!existing || (existing.id === null && distiller.id !== null)) {
      distillersByName.set(normalizedDistillerName, distiller);
    }
  }

  const normalizedBottlerName = proposedBottle.bottler
    ? normalizeString(proposedBottle.bottler.name).toLowerCase()
    : null;
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
    distillers: Array.from(distillersByName.values()),
    bottler:
      normalizedBottlerName && normalizedBottlerName === normalizedBrandName
        ? null
        : proposedBottle.bottler,
  };
}
