import { z } from "zod";
import type { BadgeTasting } from "../types";

export const BottleCheckConfigSchema = z.object({
  bottle: z.array(z.number()).min(1, "At least one bottle is required."),
});

export class BottleCheck {
  test(config: z.infer<typeof BottleCheckConfigSchema>, tasting: BadgeTasting) {
    return config.bottle.includes(tasting.identity.bottleId);
  }
}
