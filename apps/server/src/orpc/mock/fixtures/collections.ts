import type { MockOutputs } from "../contract";
import { mockBottle, mockBottles } from "./bottles";

type CollectionBottle =
  MockOutputs["collections"]["bottles"]["list"]["results"][number];

export const mockCollectionBottle = {
  id: 9701,
  imageUrl: null,
  status: "open",
  bottle: mockBottle,
  hasTasted: true,
} satisfies CollectionBottle;

export const mockCollectionBottles = [
  mockCollectionBottle,
  {
    id: 9702,
    imageUrl: null,
    status: "sealed",
    bottle: mockBottles[1]!,
    hasTasted: true,
  },
  {
    id: 9703,
    imageUrl: null,
    status: "open",
    bottle: mockBottles[2]!,
    hasTasted: false,
  },
  {
    id: 9704,
    imageUrl: null,
    status: "empty",
    bottle: mockBottles[3]!,
    hasTasted: true,
  },
  {
    id: 9705,
    imageUrl: null,
    status: "sealed",
    bottle: mockBottles[4]!,
    hasTasted: false,
  },
  {
    id: 9706,
    imageUrl: null,
    status: null,
    bottle: mockBottles[5]!,
    hasTasted: true,
  },
] satisfies CollectionBottle[];
