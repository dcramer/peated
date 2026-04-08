type MaybeWithAbv = {
  abv?: number | null | undefined;
};

const MAX_PERCENT_ABV = 100;
const MAX_US_PROOF = 200;

export function normalizePotentialProofToAbv(
  value: number | null | undefined,
): number | null | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return value;
  }

  if (value < 0) {
    return null;
  }

  if (value > MAX_PERCENT_ABV && value <= MAX_US_PROOF) {
    return Number((value / 2).toFixed(3));
  }

  if (value > MAX_US_PROOF) {
    return null;
  }

  return value;
}

export function normalizePotentialProofLikeAbvFields<T extends MaybeWithAbv>(
  value: T,
): T {
  if (!("abv" in value)) {
    return value;
  }

  const normalizedAbv = normalizePotentialProofToAbv(value.abv);
  if (normalizedAbv === value.abv) {
    return value;
  }

  return {
    ...value,
    abv: normalizedAbv,
  };
}

export function normalizePotentialProofLikeDecision<
  T extends {
    proposedBottle?: MaybeWithAbv | null | undefined;
    proposedRelease?: MaybeWithAbv | null | undefined;
  },
>(decision: T): T {
  const normalizedBottle = decision.proposedBottle
    ? normalizePotentialProofLikeAbvFields(decision.proposedBottle)
    : decision.proposedBottle;
  const normalizedRelease = decision.proposedRelease
    ? normalizePotentialProofLikeAbvFields(decision.proposedRelease)
    : decision.proposedRelease;

  if (
    normalizedBottle === decision.proposedBottle &&
    normalizedRelease === decision.proposedRelease
  ) {
    return decision;
  }

  return {
    ...decision,
    proposedBottle: normalizedBottle,
    proposedRelease: normalizedRelease,
  };
}
