import type { BadgeTasting } from "../types";
import { Tracker } from "./base";

export class BottleTracker extends Tracker {
  track(tasting: BadgeTasting) {
    return tasting.identity.kind === "bottle"
      ? [{ type: "bottle" as const, id: tasting.identity.bottleId }]
      : [];
  }
}
