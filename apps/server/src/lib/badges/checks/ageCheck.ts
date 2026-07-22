import { z } from "zod";
import type { BadgeTasting } from "../types";

export const AgeCheckConfigSchema = z.object({
  minAge: z.number().min(0).max(100),
  maxAge: z.number().min(0).max(100),
});

export class AgeCheck {
  test(config: z.infer<typeof AgeCheckConfigSchema>, tasting: BadgeTasting) {
    if (!tasting.identity.statedAge) return false;
    return (
      tasting.identity.statedAge >= config.minAge &&
      tasting.identity.statedAge <= config.maxAge
    );
  }
}
