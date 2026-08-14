import type { BottlePatch } from "../bottleCheckContract";
import type { BottleContext } from "../bottleContextContract";

const GUARDED_PATCH_FIELDS = [
  "name",
  "statedAge",
  "category",
  "edition",
  "abv",
  "singleCask",
  "caskStrength",
  "vintageYear",
  "releaseYear",
  "caskSize",
  "caskType",
  "caskFill",
] as const satisfies readonly (keyof BottlePatch)[];

type GuardedPatchField = (typeof GUARDED_PATCH_FIELDS)[number];

const EVIDENCE_FIELD_NAMES = {
  name: ["name", "expression"],
  statedAge: ["statedAge", "stated_age"],
  category: ["category"],
  edition: ["edition"],
  abv: ["abv"],
  singleCask: ["singleCask", "single_cask"],
  caskStrength: ["caskStrength", "cask_strength"],
  vintageYear: ["vintageYear", "vintage_year"],
  releaseYear: ["releaseYear", "release_year"],
  caskSize: ["caskSize", "cask_size"],
  caskType: ["caskType", "cask_type"],
  caskFill: ["caskFill", "cask_fill"],
} as const satisfies Record<GuardedPatchField, readonly string[]>;

function currentFieldValue(
  context: BottleContext,
  field: GuardedPatchField,
): unknown {
  switch (field) {
    case "name":
      return context.shared.name;
    case "statedAge":
      return context.exact.statedAge ?? context.shared.statedAge;
    case "category":
      return context.shared.category;
    case "edition":
    case "abv":
    case "singleCask":
    case "caskStrength":
    case "vintageYear":
    case "releaseYear":
    case "caskSize":
    case "caskType":
    case "caskFill":
      return context.exact[field];
  }
}

function recordSupportsValue(
  record: Record<string, unknown> | null,
  field: GuardedPatchField,
  value: unknown,
) {
  if (!record) return false;

  return EVIDENCE_FIELD_NAMES[field].some(
    (fieldName) =>
      Object.prototype.hasOwnProperty.call(record, fieldName) &&
      Object.is(record[fieldName], value),
  );
}

function observationSupportsValue(
  context: BottleContext,
  field: GuardedPatchField,
  value: unknown,
) {
  return context.observations.some(
    ({ parsedIdentity, facts }) =>
      recordSupportsValue(parsedIdentity, field, value) ||
      recordSupportsValue(facts, field, value),
  );
}

function agreeingImageCount(
  context: BottleContext,
  field: GuardedPatchField,
  value: unknown,
) {
  const sourceImageIds = new Set<string>();
  for (const { labelEvidence } of context.publicImages) {
    if (
      recordSupportsValue(
        labelEvidence.extractedIdentity as Record<string, unknown> | null,
        field,
        value,
      )
    ) {
      sourceImageIds.add(labelEvidence.sourceImageId);
    }
  }
  return sourceImageIds.size;
}

/**
 * Protects populated scalar Bottle identity from a single fallible image pass.
 * Missing fields can still use one label; replacements need structured
 * field-level context before they reach moderator review. Unstructured web
 * results cannot prove which value they support.
 */
export function findUnsupportedPopulatedBottlePatchField({
  context,
  patch,
}: {
  context: BottleContext;
  patch: BottlePatch;
}): GuardedPatchField | null {
  for (const field of GUARDED_PATCH_FIELDS) {
    const proposedValue = patch[field];
    if (proposedValue === undefined) continue;

    const currentValue = currentFieldValue(context, field);
    if (currentValue === null || Object.is(currentValue, proposedValue)) {
      continue;
    }
    if (observationSupportsValue(context, field, proposedValue)) {
      continue;
    }
    if (agreeingImageCount(context, field, proposedValue) >= 2) {
      continue;
    }

    return field;
  }

  return null;
}
