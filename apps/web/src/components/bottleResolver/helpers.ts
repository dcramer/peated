import type { Inputs } from "@peated/server/orpc/router";
// The schemas barrel loads server-only modules (OAuth uses node:crypto), which
// breaks this file in Storybook's browser bundle; import the enum directly.
import { CategoryEnum } from "@peated/server/schemas/common";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import { z } from "zod";

import {
  getFieldValue,
  type PhotoIdentification,
  type PhotoIdentificationProgressEvent,
} from "./fieldValues";

export type {
  PhotoIdentification,
  PhotoIdentificationProgressEvent,
} from "./fieldValues";
export type PhotoIdentificationCreateInput =
  Inputs["tastings"]["photoIdentificationCreate"];

export function createIdempotencyKey() {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return randomId;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const parsed = z.string().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function getRawNumberFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = getRawFieldValue(result, field);
  const parsed = z.number().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function getRawStringFieldValues(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = getRawFieldValue(result, field);
  const parsed = z.string().safeParse(value);
  if (parsed.success) return [parsed.data];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = z.string().safeParse(item);
      return text.success ? [text.data] : [];
    });
  }
  return [];
}

function getRawBooleanFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = getRawFieldValue(result, field);
  const parsed = z.boolean().safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getSearchSeed(result: PhotoIdentification | null) {
  const brand = getFieldValue(result, "brand");
  const expression = getFieldValue(result, "expression");
  return [brand, expression].filter(Boolean).join(" ");
}

export function getCreateNameSeed(result: PhotoIdentification | null) {
  const decision = getCreateDecisionLike(result);
  return (
    decision?.proposedBottle.name ??
    getRawStringFieldValue(result, "expression") ??
    ""
  );
}

export function getCreateBottlePrefill(
  result: PhotoIdentification | null,
): CreateBottlePrefill {
  const decision = getCreateDecisionLike(result);
  const proposedBottle = decision?.proposedBottle ?? null;

  const category = CategoryEnum.safeParse(
    proposedBottle?.category ?? getRawStringFieldValue(result, "category"),
  );

  return {
    brandId: proposedBottle?.brand.id ?? null,
    brandName:
      proposedBottle?.brand.name ??
      getRawStringFieldValue(result, "brand") ??
      null,
    category: category.success ? category.data : null,
    distillers: proposedBottle?.distillers.length
      ? proposedBottle.distillers
      : getRawStringFieldValues(result, "distillery").map((name) => ({
          id: null,
          name,
        })),
    bottlerId: proposedBottle?.bottler?.id ?? null,
    bottlerName:
      proposedBottle?.bottler?.name ??
      getRawStringFieldValue(result, "bottler") ??
      null,
    seriesId: proposedBottle?.series?.id ?? null,
    seriesName:
      proposedBottle?.series?.name ??
      getRawStringFieldValue(result, "series") ??
      null,
    statedAge:
      proposedBottle?.statedAge ?? getRawNumberFieldValue(result, "statedAge"),
    abv: proposedBottle?.abv ?? getRawNumberFieldValue(result, "abv"),
    edition:
      proposedBottle?.edition ??
      getRawStringFieldValue(result, "edition") ??
      null,
    vintageYear:
      proposedBottle?.vintageYear ??
      getRawNumberFieldValue(result, "vintageYear"),
    bottlingYear:
      proposedBottle?.bottlingYear ??
      getRawNumberFieldValue(result, "bottlingYear"),
    releaseYear:
      proposedBottle?.releaseYear ??
      getRawNumberFieldValue(result, "releaseYear"),
    caskStrength:
      proposedBottle?.caskStrength ??
      getRawBooleanFieldValue(result, "caskStrength"),
    singleCask:
      proposedBottle?.singleCask ??
      getRawBooleanFieldValue(result, "singleCask"),
    maturation:
      proposedBottle?.maturation ??
      getRawStringFieldValue(result, "maturation") ??
      null,
    caskNumber:
      proposedBottle?.caskNumber ??
      getRawStringFieldValue(result, "caskNumber") ??
      null,
    outturn:
      proposedBottle?.outturn ?? getRawNumberFieldValue(result, "outturn"),
  };
}

export function hasRecognizedLabelDetails(result: PhotoIdentification | null) {
  return Boolean(
    getFieldValue(result, "brand") ||
    getFieldValue(result, "expression") ||
    getFieldValue(result, "statedAge") ||
    getFieldValue(result, "abv") ||
    getFieldValue(result, "edition") ||
    getFieldValue(result, "vintageYear") ||
    getFieldValue(result, "bottlingYear") ||
    getFieldValue(result, "releaseYear") ||
    getFieldValue(result, "caskNumber"),
  );
}

export function getMatchedBottle(result: PhotoIdentification | null) {
  if (
    result?.classification.status === "classified" &&
    result.classification.decision.action === "match"
  ) {
    return result.classification.decision.matchedBottle;
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

  return result.classification.decision.action === "create_bottle"
    ? result.classification.decision
    : null;
}

export function getProposedName(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (!decision) return null;

  return [decision.proposedBottle.brand.name, decision.proposedBottle.name]
    .filter(Boolean)
    .join(" ");
}

/** Says in one line why the photo did not lead straight to a Bottle. */
export function getFallbackReason(result: PhotoIdentification | null) {
  if (getCreateDecision(result)) {
    return "This label looks new to Peated. Check the details before you add it.";
  }
  if (hasRecognizedLabelDetails(result)) {
    return "We read the label but couldn't match it to a bottle.";
  }
  return "We couldn't read enough from this label.";
}

type PhotoIdentificationStep = Extract<
  PhotoIdentificationProgressEvent,
  { type: "step" }
>["step"];

export type PhotoMatchCandidate = Extract<
  PhotoIdentificationProgressEvent,
  { type: "candidates" }
>["bottles"][number];

/** What a member has seen so far while a photo is identified. */
export type PhotoProgress = {
  pendingImage: PhotoIdentification["pendingImage"] | null;
  imageEvidence: PhotoIdentification["imageEvidence"] | null;
  candidates: PhotoMatchCandidate[];
  step: PhotoIdentificationStep | null;
};

export const EMPTY_PHOTO_PROGRESS: PhotoProgress = {
  pendingImage: null,
  imageEvidence: null,
  candidates: [],
  step: null,
};

export function applyPhotoProgress(
  progress: PhotoProgress,
  event: PhotoIdentificationProgressEvent,
): PhotoProgress {
  switch (event.type) {
    case "photo":
      return { ...progress, pendingImage: event.pendingImage };
    case "label":
      return { ...progress, imageEvidence: event.imageEvidence };
    case "candidates":
      return { ...progress, candidates: event.bottles };
    case "step":
      return { ...progress, step: event.step };
  }
}

const STEP_STATUS = {
  checking_peated: "Checking Peated…",
  checking_web: "Checking the web…",
  comparing: "Comparing details…",
} satisfies Record<PhotoIdentificationStep, string>;

/** One plain line naming the current step, readable without animation. */
export function getPhotoProgressStatus(progress: PhotoProgress) {
  if (progress.step) return STEP_STATUS[progress.step];
  if (progress.imageEvidence) return "Checking Peated…";
  return "Reading the label…";
}

/** After this long, point the member to the ways out. */
export const SLOW_PHOTO_IDENTIFICATION_MS = 45_000;

/** One line naming what the label reading found, such as brand, name, age, and ABV. */
export function getLabelSummary(
  imageEvidence: PhotoIdentification["imageEvidence"],
) {
  const result = { imageEvidence };
  return (
    [
      getFieldValue(result, "brand"),
      getFieldValue(result, "expression"),
      getFieldValue(result, "statedAge"),
      getFieldValue(result, "abv"),
    ]
      .filter(Boolean)
      .join(" · ") || null
  );
}
