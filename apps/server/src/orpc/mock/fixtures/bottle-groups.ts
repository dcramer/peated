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
  medianScore: 89,
  minScore: 80,
  maxScore: 96,
  memberScoreCount: 24,
  externalScoreCount: 6,
  scoreCount: 30,
  tastingBandCounts: {
    mediocre: 2,
    good: 8,
    very_good: 14,
    outstanding: 40,
    unicorn: 11,
  },
  totalTastings: 75,
  totalBottles: 2,
  createdByActorId: 9101,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies MockOutputs["bottleGroups"]["details"];
