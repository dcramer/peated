import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";

export type PhotoIdentification = Outputs["tastings"]["photoIdentification"];
export type PhotoIdentificationCreateInput =
  Inputs["tastings"]["photoIdentificationCreate"];

type ManualResultCopy = {
  title: string;
  description: string;
  createLabel?: string;
  primaryAction?: "search" | "create";
};

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = result?.imageEvidence.fieldCandidates[field]?.value;
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "statedAge") return `${value} years`;
  if (field === "abv") return `${value}% ABV`;
  if (field === "category") {
    return String(value)
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return String(value);
}

function getRawFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = result?.imageEvidence.fieldCandidates[field]?.value;
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function getRawStringFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = getRawFieldValue(result, field);
  return typeof value === "string" ? value : null;
}

function getRawNumberFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = getRawFieldValue(result, field);
  return typeof value === "number" ? value : null;
}

export function getSearchSeed(result: PhotoIdentification | null) {
  const brand = getFieldValue(result, "brand");
  const expression = getFieldValue(result, "expression");
  return [brand, expression].filter(Boolean).join(" ");
}

export function getCreateNameSeed(result: PhotoIdentification | null) {
  const decision = getCreateDecisionLike(result);
  return (
    getRawStringFieldValue(result, "expression") ??
    getProposedBottle(decision)?.name ??
    ""
  );
}

export function getCreateBottlePrefill(
  result: PhotoIdentification | null,
): CreateBottlePrefill {
  const decision = getCreateDecisionLike(result);
  const proposedBottle = getProposedBottle(decision);
  const proposedRelease = getProposedRelease(decision);

  return {
    brandName:
      getRawStringFieldValue(result, "brand") ??
      proposedBottle?.brand.name ??
      null,
    statedAge: getRawNumberFieldValue(result, "statedAge"),
    abv: getRawNumberFieldValue(result, "abv"),
    edition:
      getRawStringFieldValue(result, "edition") ??
      proposedRelease?.edition ??
      null,
    vintageYear: getRawNumberFieldValue(result, "vintageYear"),
    releaseYear: getRawNumberFieldValue(result, "releaseYear"),
  };
}

function hasRecognizedLabelDetails(result: PhotoIdentification | null) {
  return Boolean(
    getFieldValue(result, "brand") ||
    getFieldValue(result, "expression") ||
    getFieldValue(result, "statedAge") ||
    getFieldValue(result, "abv") ||
    getFieldValue(result, "edition") ||
    getFieldValue(result, "vintageYear") ||
    getFieldValue(result, "releaseYear") ||
    getFieldValue(result, "caskNumber"),
  );
}

export function getMatchedBottleId(result: PhotoIdentification | null) {
  if (
    result &&
    result?.suggestedNextStep !== "needs_review" &&
    result.classification.status === "classified" &&
    result.classification.decision.action === "match"
  ) {
    return result.classification.decision.matchedBottleId;
  }
  return null;
}

export function getMatchedReleaseId(result: PhotoIdentification | null) {
  if (
    result?.classification.status === "classified" &&
    result.classification.decision.action === "match"
  ) {
    return result.classification.decision.matchedReleaseId;
  }
  return null;
}

/**
 * Returns the classifier candidate for the matched release, falling back to the
 * matched bottle candidate when the decision did not target a specific release.
 */
export function getMatchedCandidate(result: PhotoIdentification | null) {
  if (
    result?.classification.status !== "classified" ||
    result.classification.decision.action !== "match"
  ) {
    return null;
  }

  const { matchedBottleId, matchedReleaseId } = result.classification.decision;
  return (
    result.classification.artifacts.candidates.find(
      (candidate) =>
        candidate.bottleId === matchedBottleId &&
        (candidate.releaseId ?? null) === (matchedReleaseId ?? null),
    ) ??
    result.classification.artifacts.candidates.find(
      (candidate) => candidate.bottleId === matchedBottleId,
    ) ??
    null
  );
}

export function getCreateDecision(result: PhotoIdentification | null) {
  if (
    result?.suggestedNextStep !== "confirm_create" ||
    result.classification.status !== "classified"
  ) {
    return null;
  }

  return getCreateDecisionLike(result);
}

function getCreateDecisionLike(result: PhotoIdentification | null) {
  if (result?.classification.status !== "classified") {
    return null;
  }

  switch (result.classification.decision.action) {
    case "create_bottle":
    case "create_release":
    case "create_bottle_and_release":
    case "repair_parent_and_create_release":
      return result.classification.decision;
    default:
      return null;
  }
}

type CreateDecisionLike = NonNullable<ReturnType<typeof getCreateDecisionLike>>;

function getProposedBottle(decision: CreateDecisionLike | null) {
  if (!decision) return null;
  if (
    decision.action === "create_bottle" ||
    decision.action === "create_bottle_and_release" ||
    decision.action === "repair_parent_and_create_release"
  ) {
    return decision.proposedBottle;
  }
  return null;
}

function getProposedRelease(decision: CreateDecisionLike | null) {
  if (!decision) return null;
  if (
    decision.action === "create_release" ||
    decision.action === "create_bottle_and_release" ||
    decision.action === "repair_parent_and_create_release"
  ) {
    return decision.proposedRelease;
  }
  return null;
}

export function getProposedName(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (!decision) return null;

  if (
    decision.action === "create_release" ||
    decision.action === "repair_parent_and_create_release"
  ) {
    return decision.proposedRelease.edition ?? "New release";
  }

  if (decision.action === "create_bottle_and_release") {
    return [
      decision.proposedBottle.brand.name,
      decision.proposedBottle.name,
      decision.proposedRelease.edition,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [decision.proposedBottle.brand.name, decision.proposedBottle.name]
    .filter(Boolean)
    .join(" ");
}

function getParentBottleName(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (
    !decision ||
    (decision.action !== "create_release" &&
      decision.action !== "repair_parent_and_create_release")
  ) {
    return null;
  }

  const parent = result?.classification.artifacts.candidates.find(
    (candidate) =>
      candidate.bottleId === decision.parentBottleId &&
      (candidate.releaseId === null || candidate.releaseId === undefined),
  );
  return parent?.bottleFullName || parent?.fullName || null;
}

export function getCreateProposalLabel(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (!decision) return null;
  const parentBottleName = getParentBottleName(result);

  if (
    decision.action === "create_release" ||
    decision.action === "repair_parent_and_create_release"
  ) {
    return {
      title: "Bottling not in Peated",
      description: parentBottleName
        ? `Create a new bottling for ${parentBottleName}.`
        : "Create a new bottling for this bottle.",
    };
  }

  if (decision.action === "create_bottle_and_release") {
    return {
      title: "Bottle not in Peated",
      description: "Create the bottle and its specific bottling.",
    };
  }

  return {
    title: "Bottle not in Peated",
    description: "Create a new bottle from this label.",
  };
}

export function getManualResultCopy(
  result: PhotoIdentification | null,
): ManualResultCopy {
  const action =
    result?.classification.status === "classified"
      ? result.classification.decision.action
      : null;

  if (result?.suggestedNextStep === "needs_review") {
    return {
      title: "We couldn't identify this bottle",
      description:
        "We found a possible match, but it was not reliable enough to use automatically. Search can still find the right bottle.",
      createLabel: undefined,
    };
  }

  if (action === "match") {
    return {
      title: "We couldn't confirm the match",
      description:
        "We found a possible match, but it was not reliable enough to use automatically.",
      createLabel: undefined,
    };
  }

  if (action === "no_match") {
    if (hasRecognizedLabelDetails(result)) {
      return {
        title: "We couldn't find this bottle",
        description:
          "We found label details, but not enough to choose an existing bottle automatically. Review them before creating it in Peated.",
        createLabel: "Create Bottle",
        primaryAction: "create" as const,
      };
    }

    return {
      title: "We couldn't identify the bottle",
      description:
        "Search can still find it, or you can start over with a clearer photo.",
      createLabel: "Create Manually",
      primaryAction: "search" as const,
    };
  }

  if (
    action === "create_bottle" ||
    action === "create_release" ||
    action === "create_bottle_and_release" ||
    action === "repair_parent_and_create_release"
  ) {
    return {
      title: "We couldn't find this bottle",
      description:
        "We found label details, but not enough to choose an existing bottle automatically. Review them before creating it in Peated.",
      createLabel: "Create Bottle",
      primaryAction: "create" as const,
    };
  }

  return {
    title: "We couldn't identify the bottle",
    description:
      "Search can still find it, or you can start over with another photo.",
    createLabel: "Create Manually",
    primaryAction: "search" as const,
  };
}
