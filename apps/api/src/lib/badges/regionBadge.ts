import type { IBadge, TastingWithRelations } from "./base";

export type RegionConfig = {
  country: string;
  region: string;
};

export const RegionBadge: IBadge<RegionConfig> = {
  test: (config: RegionConfig, tasting: TastingWithRelations) => {
    const { region, country } = config;
    const { brand, bottlesToDistillers } = tasting.bottle;

    if (country === brand.country && region === brand.region) return true;
    if (
      bottlesToDistillers.find(
        ({ distiller: d }) => country === d.country && region === d.region,
      )
    )
      return true;
    return false;
  },
};
