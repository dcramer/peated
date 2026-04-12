import { sha1 } from "@peated/server/lib/hash";

export const LEGACY_RELEASE_REPAIR_REVIEW_VERSION = 1;

type LegacyReleaseRepairReviewIdentity = {
  proposedParentFullName: string;
  releaseIdentity: {
    edition: string | null;
    releaseYear: number | null;
  };
};

type LegacyReleaseRepairClassifierInputBottle = {
  abv: null | number;
  brandId: null | number;
  category: null | string;
  caskFill: null | string;
  caskSize: null | string;
  caskStrength: null | boolean;
  caskType: null | string;
  edition: null | string;
  fullName: string;
  releaseYear: null | number;
  singleCask: null | boolean;
  statedAge: null | number;
  vintageYear: null | number;
};

type LegacyReleaseRepairClassifierInputParent = {
  abv: null | number;
  category: null | string;
  caskFill: null | string;
  caskSize: null | string;
  caskStrength: null | boolean;
  caskType: null | string;
  edition: null | string;
  fullName: string;
  id: number;
  releaseYear: null | number;
  singleCask: null | boolean;
  statedAge: null | number;
  vintageYear: null | number;
};

export function getLegacyReleaseRepairBottleFingerprint(
  bottle: LegacyReleaseRepairClassifierInputBottle,
) {
  return sha1(
    bottle.brandId,
    bottle.fullName,
    bottle.category,
    bottle.edition,
    bottle.statedAge,
    bottle.abv,
    bottle.singleCask === null ? null : Number(bottle.singleCask),
    bottle.caskStrength === null ? null : Number(bottle.caskStrength),
    bottle.vintageYear,
    bottle.releaseYear,
    bottle.caskType,
    bottle.caskSize,
    bottle.caskFill,
  );
}

export function getLegacyReleaseRepairParentCandidatesFingerprint(
  parentRows: LegacyReleaseRepairClassifierInputParent[],
) {
  return sha1(
    ...parentRows
      .slice()
      .sort((left, right) => left.id - right.id)
      .flatMap((row) => [
        row.id,
        row.fullName,
        row.category,
        row.edition,
        row.statedAge,
        row.releaseYear,
        row.vintageYear,
        row.abv,
        row.singleCask === null ? null : Number(row.singleCask),
        row.caskStrength === null ? null : Number(row.caskStrength),
        row.caskFill,
        row.caskType,
        row.caskSize,
      ]),
  );
}

export function isMatchingLegacyReleaseRepairReviewIdentity(
  candidate: LegacyReleaseRepairReviewIdentity,
  review: {
    proposedParentFullName: string;
    releaseEdition: string | null;
    releaseYear: number | null;
  },
) {
  return (
    review.proposedParentFullName.toLowerCase() ===
      candidate.proposedParentFullName.toLowerCase() &&
    (review.releaseEdition ?? null) === candidate.releaseIdentity.edition &&
    (review.releaseYear ?? null) === candidate.releaseIdentity.releaseYear
  );
}

export function isMatchingLegacyReleaseRepairReview(
  candidate: LegacyReleaseRepairReviewIdentity & {
    legacyBottleFingerprint: string;
    parentCandidatesFingerprint: string;
  },
  review: {
    legacyBottleFingerprint: null | string;
    parentCandidatesFingerprint: null | string;
    proposedParentFullName: string;
    releaseEdition: string | null;
    releaseYear: number | null;
  },
) {
  return (
    review.legacyBottleFingerprint === candidate.legacyBottleFingerprint &&
    review.parentCandidatesFingerprint ===
      candidate.parentCandidatesFingerprint &&
    isMatchingLegacyReleaseRepairReviewIdentity(candidate, review)
  );
}
