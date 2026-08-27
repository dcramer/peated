import type { MockOutputs } from "../contract";
import { timestamp } from "./constants";
import { mockLaphroaigEntity } from "./entities";

export const mockBottleGroup = {
  schemaVersion: 1,
  id: 9701,
  fullName: "Laphroaig Càirdeas",
  name: "Càirdeas",
  brandId: mockLaphroaigEntity.id,
  bottlerId: null,
  distillerIds: [mockLaphroaigEntity.id],
  category: "single_malt",
  seriesId: null,
  statedAge: null,
  representativeBottleId: 9309,
  flavorProfile: "heavily_peated",
  avgRating: 1.5,
  avgScore: 89,
  totalScores: 30,
  ratingStats: {
    pass: 2,
    sip: 8,
    savor: 20,
    total: 30,
    avg: 1.53,
    percentage: { pass: 6.7, sip: 26.7, savor: 66.7 },
  },
  totalTastings: 75,
  totalBottles: 2,
  createdByActorId: 9101,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies MockOutputs["bottleGroups"]["details"];
