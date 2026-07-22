import { z } from "zod";
import type { BadgeTasting } from "../types";

export const RegionCheckConfigSchema = z.object({
  country: z.number(),
  region: z.number().nullable().default(null),
});

export class RegionCheck {
  test(config: z.infer<typeof RegionCheckConfigSchema>, tasting: BadgeTasting) {
    const { brand, distillers } = tasting.identity;

    const { region, country } = config;
    if (country === brand.countryId && (!region || region === brand.regionId))
      return true;

    if (
      distillers.find(
        (distiller) =>
          country === distiller.countryId &&
          (!region || region === distiller.regionId),
      )
    )
      return true;

    return false;
  }
}
