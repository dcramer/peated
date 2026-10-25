import type { BottleFormInitialData } from "@peated/web/components/bottleForm";
import { z } from "zod";

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
  | "caskNumber"
  | "maturation"
  | "outturn"
  | "tastingNotes";

type StableField =
  | "statedAge"
  | "series"
  | "category"
  | "brand"
  | "distillers"
  | "bottler";

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

const OwnDistilleryBottlerSchema = z.object({
  brand: z.object({ id: z.number(), kind: z.literal("distillery") }),
  bottler: z.object({ id: z.number() }),
});

// Whisky Identity Model: an official distillery release has no bottler. When
// the source names its distillery Brand as bottler, that value is no evidence
// for the new Bottle, so the person or classifier decides it fresh. Any other
// bottler still copies, such as an independent bottler's own label.
function withoutOwnDistilleryBottler(
  sourceBottle: BottleFormInitialData | null | undefined,
) {
  const parsed = OwnDistilleryBottlerSchema.safeParse(sourceBottle);
  if (!parsed.success || parsed.data.bottler.id !== parsed.data.brand.id) {
    return sourceBottle;
  }
  return { ...sourceBottle, bottler: null };
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
    caskNumber: mergeExactField("caskNumber", input),
    maturation: mergeExactField("maturation", input),
    outturn: mergeExactField("outturn", input),
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
    bottler: selectStableField("bottler", {
      sourceBottle: withoutOwnDistilleryBottler(sourceBottle),
      proposedBottle,
    }),
    ...exact,
    ...description,
  };
}
