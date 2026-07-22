import type { BottleFormInitialData } from "@peated/web/components/bottleForm";
import { buildIndependentBottleProposalDraft } from "@peated/web/lib/independentBottleProposal";

export function mergeCreateBottleInitialData({
  initialData,
  proposalData,
  proposalExactData,
  proposalImageUrl,
  distiller,
  brand,
  bottler,
  series,
}: {
  initialData: BottleFormInitialData;
  proposalData?: BottleFormInitialData | null;
  proposalExactData?: BottleFormInitialData | null;
  proposalImageUrl?: string | null;
  distiller?: NonNullable<BottleFormInitialData["distillers"]>[number];
  brand?: BottleFormInitialData["brand"];
  bottler?: BottleFormInitialData["bottler"];
  series?: BottleFormInitialData["series"];
}): BottleFormInitialData {
  const draft = buildIndependentBottleProposalDraft({
    sourceBottle: initialData,
    proposedBottle: proposalData,
    proposedRelease: proposalExactData,
  });

  return {
    ...draft,
    imageUrl: proposalImageUrl ?? initialData.imageUrl,
    distillers: distiller ? [distiller] : (draft.distillers ?? []),
    brand: brand ?? draft.brand,
    bottler: bottler ?? draft.bottler,
    series: series ?? draft.series,
  };
}
