import { z } from "zod";
import type { BadgeTasting } from "../types";

export const EveryTastingCheckConfigSchema = z.unknown().default({});

export class EveryTastingCheck {
  test(_config: unknown, _tasting: BadgeTasting) {
    return true;
  }
}
