import type { MockOutputs } from "../contract";

export const mockStats = {
  asOf: "2026-08-28T15:00:00.000Z",
  bottles: 28_430,
  brands: 3_980,
  distilleries: 2_410,
  bottlers: 1_125,
  blenders: 420,
  companies: 1_280,
  tastings: 142_580,
  memberReviews: 8_420,
  externalReviews: 56_730,
} satisfies MockOutputs["stats"];
