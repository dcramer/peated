import type { MockOutputs } from "../contract";

export const mockStats = {
  totalTastings: 142_580,
  totalBottles: 28_430,
  totalEntities: 9_215,
  totalBrands: 3_980,
  totalDistilleries: 2_410,
  totalBottlers: 1_125,
  totalBlenders: 420,
  totalCompanies: 1_280,
} satisfies MockOutputs["stats"];
