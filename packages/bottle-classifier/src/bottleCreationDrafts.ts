import type { ProposedBottle, ProposedRelease } from "./classifierTypes";
import {
  normalizeBottle,
  normalizeString,
  stripDuplicateBrandPrefixFromBottleName,
} from "./normalize";
import { DEFAULT_BOTTLE_CREATION_TARGET } from "./releaseIdentity";

export type BottleCreationTarget = "bottle" | "release" | "bottle_and_release";

const EMPTY_PROPOSED_RELEASE: ProposedRelease = {
  edition: null,
  statedAge: null,
  abv: null,
  caskStrength: null,
  singleCask: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  description: null,
  tastingNotes: null,
  imageUrl: null,
};

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

function hasReleaseSpecificDraft(proposedRelease: ProposedRelease | null) {
  if (!proposedRelease) {
    return false;
  }

  return [
    proposedRelease.edition,
    proposedRelease.statedAge,
    proposedRelease.abv,
    proposedRelease.caskStrength,
    proposedRelease.singleCask,
    proposedRelease.vintageYear,
    proposedRelease.releaseYear,
    proposedRelease.caskType,
    proposedRelease.caskSize,
    proposedRelease.caskFill,
  ].some((value) => value !== null && value !== undefined);
}

export function inferBottleCreationTarget({
  bottle,
  release,
}: {
  bottle?: unknown | null;
  release?: unknown | null;
}): BottleCreationTarget | null {
  if (bottle && release) {
    return "bottle_and_release";
  }

  if (bottle) {
    return "bottle";
  }

  if (release) {
    return "release";
  }

  return null;
}

export function splitProposedBottleReleaseDraft({
  proposedBottle,
  proposedRelease,
}: {
  proposedBottle: ProposedBottle;
  proposedRelease?: ProposedRelease | null;
}): {
  proposedBottle: ProposedBottle;
  proposedRelease: ProposedRelease | null;
} {
  const normalizedBottle = normalizeProposedBottleDraft(proposedBottle);
  const releaseFromBottle: ProposedRelease = {
    ...EMPTY_PROPOSED_RELEASE,
    edition: normalizedBottle.edition,
    abv: normalizedBottle.abv,
    caskStrength: normalizedBottle.caskStrength,
    singleCask: normalizedBottle.singleCask,
    vintageYear: normalizedBottle.vintageYear,
    releaseYear: normalizedBottle.releaseYear,
    caskType: normalizedBottle.caskType,
    caskSize: normalizedBottle.caskSize,
    caskFill: normalizedBottle.caskFill,
  };

  const mergedRelease: ProposedRelease = {
    ...releaseFromBottle,
    ...(proposedRelease ?? {}),
  };

  const bottleWithoutReleaseLeak: ProposedBottle = {
    ...normalizedBottle,
    edition: null,
    abv: null,
    caskStrength: null,
    singleCask: null,
    vintageYear: null,
    releaseYear: null,
    caskType: null,
    caskSize: null,
    caskFill: null,
  };

  return {
    proposedBottle: bottleWithoutReleaseLeak,
    proposedRelease: hasReleaseSpecificDraft(mergedRelease)
      ? mergedRelease
      : null,
  };
}

export function normalizeBottleCreationDrafts({
  creationTarget,
  proposedBottle,
  proposedRelease,
}: {
  creationTarget?: BottleCreationTarget | null;
  proposedBottle?: ProposedBottle | null;
  proposedRelease?: ProposedRelease | null;
}): {
  creationTarget: BottleCreationTarget;
  proposedBottle: ProposedBottle | null;
  proposedRelease: ProposedRelease | null;
} {
  const requestedCreationTarget =
    creationTarget ?? DEFAULT_BOTTLE_CREATION_TARGET;

  if (requestedCreationTarget === "bottle") {
    return {
      creationTarget: "bottle",
      proposedBottle: proposedBottle
        ? normalizeProposedBottleDraft(proposedBottle)
        : null,
      proposedRelease: null,
    };
  }

  const normalizedDrafts = proposedBottle
    ? splitProposedBottleReleaseDraft({
        proposedBottle,
        proposedRelease: proposedRelease ?? null,
      })
    : {
        proposedBottle: null,
        proposedRelease: proposedRelease ?? null,
      };

  if (requestedCreationTarget === "release") {
    return {
      creationTarget:
        inferBottleCreationTarget({
          release: normalizedDrafts.proposedRelease,
        }) ?? "release",
      proposedBottle: null,
      proposedRelease: normalizedDrafts.proposedRelease,
    };
  }

  return {
    ...normalizedDrafts,
    creationTarget:
      inferBottleCreationTarget({
        bottle: normalizedDrafts.proposedBottle,
        release: normalizedDrafts.proposedRelease,
      }) ?? requestedCreationTarget,
  };
}
