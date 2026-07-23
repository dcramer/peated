import { IndependentConcreteBottleCreateRouteInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import type { BottleFormInitialData } from "@peated/web/components/bottleForm";

type ProposalDraftInput = {
  sourceBottle?: BottleFormInitialData | null;
  sourceSharedName?: BottleFormInitialData["name"];
  proposedBottle?: BottleFormInitialData | null;
  proposedRelease?: BottleFormInitialData | null;
};

type ExactField =
  | "edition"
  | "abv"
  | "singleCask"
  | "caskStrength"
  | "vintageYear"
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
  { sourceBottle, proposedBottle, proposedRelease }: ProposalDraftInput,
): BottleFormInitialData[Field] {
  const sourceValue = sourceBottle?.[field];
  const bottleValue = proposedBottle?.[field];
  const releaseValue = proposedRelease?.[field];

  if (proposedRelease && proposedBottle) {
    return releaseValue ?? bottleValue ?? sourceValue;
  }
  if (proposedRelease) {
    return releaseValue === undefined ? sourceValue : releaseValue;
  }
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
  proposedRelease,
}: ProposalDraftInput): Pick<
  BottleFormInitialData,
  "description" | "descriptionSrc"
> {
  if (proposedRelease && proposedBottle) {
    if (proposedRelease.description != null) {
      return { description: proposedRelease.description, descriptionSrc: null };
    }
    if (proposedBottle.description != null) {
      return {
        description: proposedBottle.description,
        descriptionSrc: proposedBottle.descriptionSrc,
      };
    }
  } else if (proposedRelease?.description !== undefined) {
    return { description: proposedRelease.description, descriptionSrc: null };
  } else if (proposedBottle?.description !== undefined) {
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

/** Composes legacy proposal evidence into one independently complete Bottle draft. */
export function buildIndependentBottleProposalDraft({
  sourceBottle,
  sourceSharedName,
  proposedBottle,
  proposedRelease,
}: ProposalDraftInput): BottleFormInitialData {
  const exact = mergeExactFields({
    sourceBottle,
    proposedBottle,
    proposedRelease,
  });
  const description = selectDescription({
    sourceBottle,
    proposedBottle,
    proposedRelease,
  });

  return {
    name: selectStableName({
      sourceBottle,
      sourceSharedName,
      proposedBottle,
    }),
    statedAge:
      proposedRelease?.statedAge ??
      selectStableField("statedAge", { sourceBottle, proposedBottle }),
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

/** Parses a proposal draft at the same boundary as ordinary Bottle creation. */
export function buildIndependentBottleProposalInput(input: ProposalDraftInput) {
  return IndependentConcreteBottleCreateRouteInputSchema.parse(
    buildIndependentBottleProposalDraft(input),
  );
}
