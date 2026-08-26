import type { BottleFormInitialData } from "@peated/web/components/bottleForm";

type ProposalDraftInput = {
  sourceBottle?: BottleFormInitialData | null;
  sourceSharedName?: BottleFormInitialData["name"];
  proposedBottle?: BottleFormInitialData | null;
};

type ExactField =
  | "edition"
  | "abv"
  | "singleCask"
  | "caskStrength"
  | "vintageYear"
  | "bottlingYear"
  | "releaseYear"
  | "caskSize"
  | "caskType"
  | "caskFill"
  | "tastingNotes";

type StableField =
  | "statedAge"
  | "series"
  | "category"
  | "brand"
  | "distillers"
  | "bottler"
  | "flavorProfile";

function selectStableField<Field extends StableField>(
  field: Field,
  { sourceBottle, proposedBottle }: ProposalDraftInput,
): BottleFormInitialData[Field] {
  const proposedValue = proposedBottle?.[field];
  return proposedBottle &&
    Object.hasOwn(proposedBottle, field) &&
    proposedValue != null
    ? proposedValue
    : sourceBottle?.[field];
}

function selectStableName({
  sourceBottle,
  sourceSharedName,
  proposedBottle,
}: ProposalDraftInput): BottleFormInitialData["name"] {
  const proposedName = proposedBottle?.name;
  return proposedBottle &&
    Object.hasOwn(proposedBottle, "name") &&
    proposedName != null
    ? proposedName
    : (sourceSharedName ?? sourceBottle?.name);
}

function mergeExactField<Field extends ExactField>(
  field: Field,
  { sourceBottle, proposedBottle }: ProposalDraftInput,
): BottleFormInitialData[Field] {
  const sourceValue = sourceBottle?.[field];
  const bottleValue = proposedBottle?.[field];

  if (proposedBottle) {
    return bottleValue === undefined ? sourceValue : bottleValue;
  }
  return sourceValue;
}

function mergeExactFields(
  input: ProposalDraftInput,
): Pick<BottleFormInitialData, ExactField> {
  return {
    edition: mergeExactField("edition", input),
    abv: mergeExactField("abv", input),
    singleCask: mergeExactField("singleCask", input),
    caskStrength: mergeExactField("caskStrength", input),
    vintageYear: mergeExactField("vintageYear", input),
    bottlingYear: mergeExactField("bottlingYear", input),
    releaseYear: mergeExactField("releaseYear", input),
    caskSize: mergeExactField("caskSize", input),
    caskType: mergeExactField("caskType", input),
    caskFill: mergeExactField("caskFill", input),
    tastingNotes: mergeExactField("tastingNotes", input),
  };
}

function selectDescription({
  sourceBottle,
  proposedBottle,
}: ProposalDraftInput): Pick<
  BottleFormInitialData,
  "description" | "descriptionSrc"
> {
  if (proposedBottle?.description !== undefined) {
    return {
      description: proposedBottle.description,
      descriptionSrc: proposedBottle.descriptionSrc,
    };
  }

  return {
    description: sourceBottle?.description,
    descriptionSrc: sourceBottle?.descriptionSrc,
  };
}

/** Composes one proposed Bottle with optional prefill-only source evidence. */
export function buildBottleProposalDraft({
  sourceBottle,
  sourceSharedName,
  proposedBottle,
}: ProposalDraftInput): BottleFormInitialData {
  const exact = mergeExactFields({
    sourceBottle,
    proposedBottle,
  });
  const description = selectDescription({
    sourceBottle,
    proposedBottle,
  });

  return {
    name: selectStableName({
      sourceBottle,
      sourceSharedName,
      proposedBottle,
    }),
    statedAge: selectStableField("statedAge", {
      sourceBottle,
      proposedBottle,
    }),
    series: selectStableField("series", { sourceBottle, proposedBottle }),
    category: selectStableField("category", { sourceBottle, proposedBottle }),
    brand: selectStableField("brand", { sourceBottle, proposedBottle }),
    distillers: selectStableField("distillers", {
      sourceBottle,
      proposedBottle,
    }),
    bottler: selectStableField("bottler", { sourceBottle, proposedBottle }),
    flavorProfile: selectStableField("flavorProfile", {
      sourceBottle,
      proposedBottle,
    }),
    ...exact,
    ...description,
  };
}
