import { z } from "zod";
import type { IBadge, TastingWithRelations } from "./base";

export const RegionConfig = z.object({
  regions: z.array(
    z.object({
      country: z.string(),
      region: z.string(),
    }),
  ),
});

type RegionConfigType = z.infer<typeof RegionConfig>;

export const RegionBadge: IBadge<RegionConfigType> = {
  test: (config: RegionConfigType, tasting: TastingWithRelations) => {
    const { brand, bottlesToDistillers } = tasting.bottle;

    for (const { region, country } of config.regions) {
      if (country === brand.country && region === brand.region) return true;
      if (
        bottlesToDistillers.find(
          ({ distiller: d }) => country === d.country && region === d.region,
        )
      )
        return true;
    }
    return false;
  },

  checkConfig: async (config: unknown) => {
    return RegionConfig.parse(config);
  },
};
