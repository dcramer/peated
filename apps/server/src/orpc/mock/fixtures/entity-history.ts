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
    sourceUrl:
      "https://www.malts.com/en-us/articles/lagavulin-from-the-isle-of-islay-to-global-phenomenon",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9802,
    entityId: mockEntity.id,
    kind: "acquired",
    date: "1997",
    description:
      "Became part of Diageo when Guinness and Grand Metropolitan merged.",
    newOwnerId: 9210,
    sourceUrl: "https://www.diageo.com/en/our-business/our-history",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9803,
    entityId: mockEntity.id,
    kind: "generic",
    date: "2016",
    description: "Marked its 200th anniversary with an 8-year-old whisky.",
    newOwnerId: null,
    sourceUrl:
      "https://www.malts.com/en-gb/products/lagavulin-8-year-old-single-malt-scotch-whisky-70cl",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
] satisfies MockOutputs["entities"]["events"]["list"]["results"];

export const mockEntityHistories = [
  ...mockEntityHistory,
  {
    id: 9804,
    entityId: 9204,
    kind: "opened",
    date: "1858",
    description:
      "Daniel Swigert developed a distillery at the site now known as Buffalo Trace.",
    newOwnerId: null,
    sourceUrl: "https://www.buffalotracedistillery.com/buffalo-trace-history/",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9805,
    entityId: 9204,
    kind: "acquired",
    date: "1992",
    description: "The Sazerac Company purchased the distillery.",
    newOwnerId: 9217,
    sourceUrl: "https://www.buffalotracedistillery.com/buffalo-trace-history/",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9806,
    entityId: 9206,
    kind: "opened",
    date: "1975",
    description:
      "The new Midleton Distillery opened beside the older distillery.",
    newOwnerId: null,
    sourceUrl: "https://www.irishdistillers.ie/our-story/",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9807,
    entityId: 9207,
    kind: "generic",
    date: "1912-08",
    description:
      "The first official reference to Redbreast appeared in Gilbey's records.",
    newOwnerId: null,
    sourceUrl: "https://www.redbreastwhiskey.com/en-us/heritage/",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9808,
    entityId: 9212,
    kind: "opened",
    date: "1983",
    description: "The Society made its home at The Vaults in Leith, Edinburgh.",
    newOwnerId: null,
    sourceUrl: "https://smws.com/venues/the-vaults-edinburgh",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 9809,
    entityId: 9219,
    kind: "acquired",
    date: "1988",
    description: "Irish Distillers joined Pernod Ricard.",
    newOwnerId: 9218,
    sourceUrl: "https://www.irishdistillers.ie/our-story/",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
] satisfies MockOutputs["entities"]["events"]["list"]["results"];
