import type { BottleFormInitialData } from "@peated/web/components/bottleForm";
import { buildBottleProposalDraft } from "@peated/web/lib/bottleProposalDraft";

export function mergeCreateBottleInitialData({
  initialData,
  proposalData,
  proposalImageUrl,
  distiller,
  brand,
  bottler,
  series,
}: {
  initialData: BottleFormInitialData;
  proposalData?: BottleFormInitialData | null;
  proposalImageUrl?: string | null;
  distiller?: NonNullable<BottleFormInitialData["distillers"]>[number];
  brand?: BottleFormInitialData["brand"];
  bottler?: BottleFormInitialData["bottler"];
  series?: BottleFormInitialData["series"];
}): BottleFormInitialData {
  const draft = buildBottleProposalDraft({
    sourceBottle: initialData,
    proposedBottle: proposalData,
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
