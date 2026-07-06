import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";

export type PhotoIdentification = Outputs["tastings"]["photoIdentification"];
export type PhotoIdentificationCreateInput =
  Inputs["tastings"]["photoIdentificationCreate"];

type CatalogImageApprovalTarget = "bottle" | "release";
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
  if (field === "statedAge") return `${value} years`;
  if (field === "abv") return `${value}% ABV`;
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
    result?.suggestedNextStep === "confirm_match" &&
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
    decision.action === "create_bottle_and_release"
  ) {
    return decision.proposedBottle;
  }
  return null;
}

function getProposedRelease(decision: CreateDecisionLike | null) {
  if (!decision) return null;
  if (
    decision.action === "create_release" ||
    decision.action === "create_bottle_and_release"
  ) {
    return decision.proposedRelease;
  }
  return null;
}

export function getProposedName(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (!decision) return null;

  if (decision.action === "create_release") {
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
  if (!decision || decision.action !== "create_release") return null;

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

  if (decision.action === "create_release") {
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

function getCatalogImageApprovalTarget(
  action: "create_bottle" | "create_release" | "create_bottle_and_release",
): CatalogImageApprovalTarget {
  return action === "create_bottle" ? "bottle" : "release";
}

export function getAllowedCatalogImageApprovalTarget(
  result: PhotoIdentification,
  enabled: boolean,
) {
  const decision = getCreateDecision(result);
  if (
    !enabled ||
    !decision ||
    result.imageEvidence.photoSuitability.suitableAsBottleImage !== true
  ) {
    return null;
  }

  return getCatalogImageApprovalTarget(decision.action);
}

export function getCatalogImageApprovalCopy(
  target: CatalogImageApprovalTarget,
) {
  if (target === "bottle") {
    return {
      label: "Set as Bottle Image",
      help: "This photo will be shown as the public image for the new bottle.",
    };
  }

  return {
    label: "Set as Release Image",
    help: "This photo will be shown as the public image for the new release.",
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
    action === "create_bottle_and_release"
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
