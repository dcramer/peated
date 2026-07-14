import type { BottleFormInitialData } from "@peated/web/components/bottleForm";

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
  return {
    ...initialData,
    ...(proposalData || {}),
    name: proposalData?.name || initialData.name,
    imageUrl: proposalImageUrl || initialData.imageUrl,
    distillers: distiller
      ? [distiller]
      : proposalData?.distillers || initialData.distillers || [],
    brand: brand || proposalData?.brand || initialData.brand,
    bottler: bottler || proposalData?.bottler || initialData.bottler,
    series: series || proposalData?.series || initialData.series,
  };
}
