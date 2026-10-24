import { BRORA_ABOUT_EXAMPLE } from "@peated/server/lib/entityAbout/examples/brora";
import { toPublicEntityAbout } from "@peated/server/lib/entityAbout/publicAbout";

import type { MockOutputs } from "../contract";
import { timestamp } from "./constants";
import { mockCountry, mockRegions } from "./places";

type Entity = MockOutputs["entities"]["list"]["results"][number];

// Brora's facts come from BRORA_ABOUT_EXAMPLE and its sources. Bottle counts
// below are synthetic samples shaped like a closed distillery's catalog.
export const mockBrora = {
  shortName: null,
  pronunciation: "BRAW-ruh",
  pronunciationIpa: "ˈbrɔːrə",
  pronunciationAudioUrl: null,
  status: "active",
  ownerId: 9210,
  owner: { id: 9210, peatedId: "E9210", name: "Diageo", kind: "company" },
  id: 9240,
  peatedId: "E9240",
  name: "Brora",
  kind: "distillery",
  description:
    "Brora opened in 1819 as Clynelish and took the name Brora around 1969. It closed in March 1983 and started distilling again on 19 May 2021.",
  descriptionSrc: "generated",
  yearEstablished: 1819,
  website: "https://www.malts.com/en-gb/distilleries/brora",
  country: mockCountry,
  region: mockRegions.find((region) => region.slug === "highlands") ?? null,
  address: "Brora KW9 6LR, UK",
  location: [-3.868, 58.025],
  totalTastings: 7,
  publicReviewAndTastingCount: 7,
  totalBottles: 255,
  isFollowing: false,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

export const mockEntityAbouts = new Map([
  [
    mockBrora.id,
    toPublicEntityAbout(
      {
        entityId: mockBrora.id,
        document: BRORA_ABOUT_EXAMPLE,
        version: 1,
        checkedOn: "2026-10-23",
      },
      new Map(),
    ),
  ],
]);

// The legacy history list shows the same events as the About document.
export const mockBroraHistory = BRORA_ABOUT_EXAMPLE.events.flatMap((event) => {
  const source = BRORA_ABOUT_EXAMPLE.sources.find(
    (candidate) => candidate.id === event.citations[0]?.sourceId,
  );
  const { kind } = event;
  return kind === "generic" ||
    kind === "opened" ||
    kind === "closed" ||
    kind === "mothballed" ||
    kind === "reopened"
    ? [
        {
          id: 9900 + event.id,
          entityId: mockBrora.id,
          kind,
          date: event.date,
          description: event.text,
          newOwnerId: null,
          sourceUrl: source?.url ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ]
    : [];
});

export const mockEntityVintageCounts = new Map([
  [
    mockBrora.id,
    {
      results: [
        { year: 1965, count: 1 },
        { year: 1970, count: 2 },
        { year: 1971, count: 6 },
        { year: 1972, count: 25 },
        { year: 1974, count: 5 },
        { year: 1975, count: 6 },
        { year: 1976, count: 4 },
        { year: 1977, count: 16 },
        { year: 1978, count: 15 },
        { year: 1979, count: 1 },
        { year: 1980, count: 6 },
        { year: 1981, count: 78 },
        { year: 1982, count: 69 },
        { year: 1983, count: 7 },
      ],
      withoutYear: 14,
    },
  ],
]);

export const mockEntityBottlerCounts = new Map([
  [
    mockBrora.id,
    {
      results: [
        {
          entity: {
            id: 9212,
            name: "The Scotch Malt Whisky Society",
            kind: "bottler" as const,
          },
          count: 23,
        },
        {
          entity: {
            id: 9208,
            name: "Gordon & MacPhail",
            kind: "bottler" as const,
          },
          count: 20,
        },
        {
          entity: { id: 9209, name: "Compass Box", kind: "bottler" as const },
          count: 3,
        },
      ],
      withoutEntity: 26,
    },
  ],
]);
