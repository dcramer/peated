import type { MockOutputs } from "../contract";
import { timestamp } from "./constants";
import { mockEntity } from "./entities";

export const mockEntityHistory = [
  {
    id: 9801,
    entityId: mockEntity.id,
    kind: "opened",
    date: "1816",
    description: "Licensed on the south shore of Islay.",
    newOwnerId: null,
    sourceUrl: "https://en.wikipedia.org/wiki/Lagavulin_distillery",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9802,
    entityId: mockEntity.id,
    kind: "acquired",
    date: "1927",
    description: "Ownership passed to the Distillers Company.",
    newOwnerId: 9210,
    sourceUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9803,
    entityId: mockEntity.id,
    kind: "generic",
    date: "2016-05",
    description: "A third pair of stills was installed.",
    newOwnerId: null,
    sourceUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
] satisfies MockOutputs["entities"]["events"]["list"]["results"];
