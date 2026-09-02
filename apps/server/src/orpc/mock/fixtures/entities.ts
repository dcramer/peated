import type { MockOutputs } from "../contract";
import { timestamp } from "./constants";
import {
  mockCork,
  mockCountries,
  mockCountry,
  mockEngland,
  mockFrance,
  mockKarnataka,
  mockOsaka,
  mockRegion,
  mockRegions,
} from "./places";

type Entity = MockOutputs["entities"]["list"]["results"][number];

// Catalog facts belong to each entity. The mock API must not inherit another
// producer's address, location, founding year, or ownership (see README.md).
const entityDefaults = {
  shortName: null,
  ownerId: null,
  owner: null,
  description: null,
  descriptionSrc: "user",
  yearEstablished: null,
  website: null,
  region: null,
  address: null,
  location: null,
  totalTastings: 0,
  totalBottles: 0,
  isFollowing: false,
  createdAt: timestamp,
  updatedAt: timestamp,
} as const;

export const mockDiageoEntity = {
  ...entityDefaults,
  id: 9210,
  peatedId: "E9210",
  name: "Diageo",
  kind: "company",
  country: mockEngland,
  website: "https://www.diageo.com",
  description:
    "A London-based drinks company whose Scotch whisky brands include Lagavulin, Caol Ila, Talisker, and Johnnie Walker.",
  yearEstablished: 1997,
  address: "16 Great Marlborough Street, London, W1F 7HS, UK",
} satisfies Entity;

export const mockEdringtonEntity = {
  ...entityDefaults,
  id: 9216,
  peatedId: "E9216",
  name: "Edrington",
  kind: "company",
  country: mockCountry,
  website: "https://www.edrington.com",
  description:
    "A Scottish spirits company that owns The Macallan and Highland Park.",
} satisfies Entity;

export const mockSazeracCompany = {
  ...entityDefaults,
  id: 9217,
  peatedId: "E9217",
  name: "Sazerac Company",
  kind: "company",
  country: mockCountries[2],
  website: "https://www.sazerac.com",
  description:
    "An American spirits company that owns Buffalo Trace Distillery.",
} satisfies Entity;

export const mockPernodRicardEntity = {
  ...entityDefaults,
  id: 9218,
  peatedId: "E9218",
  name: "Pernod Ricard",
  kind: "company",
  country: mockFrance,
  website: "https://www.pernod-ricard.com",
  description: "A French drinks company and the owner of Irish Distillers.",
} satisfies Entity;

export const mockIrishDistillersEntity = {
  ...entityDefaults,
  id: 9219,
  peatedId: "E9219",
  name: "Irish Distillers",
  kind: "company",
  country: mockCountries[1],
  website: "https://www.irishdistillers.ie",
  description:
    "An Irish whiskey producer that operates Midleton Distillery and owns Redbreast.",
  yearEstablished: 1966,
  ownerId: 9218,
  owner: {
    id: 9218,
    peatedId: "E9218",
    name: "Pernod Ricard",
    kind: "company",
  },
} satisfies Entity;

export const mockSuntoryGlobalSpiritsEntity = {
  ...entityDefaults,
  id: 9220,
  peatedId: "E9220",
  name: "Suntory Global Spirits",
  kind: "company",
  country: mockCountries[2],
  website: "https://www.suntoryglobalspirits.com",
  description:
    "A spirits company based in New York. Its Scotch whisky distilleries include Laphroaig and Bowmore.",
} satisfies Entity;

export const mockEntity = {
  ...entityDefaults,
  id: 9201,
  peatedId: "E9201",
  name: "Lagavulin",
  shortName: null,
  kind: "distillery",
  ownerId: 9210,
  owner: { id: 9210, peatedId: "E9210", name: "Diageo", kind: "company" },
  description: "An Islay distillery known for heavily peated single malt.",
  descriptionSrc: "user",
  yearEstablished: 1816,
  website: "https://www.malts.com/en-row/distilleries/lagavulin",
  country: mockCountry,
  region: mockRegion,
  address: "Lagavulin Distillery, Port Ellen, Isle of Islay, PA42 7DZ, UK",
  location: [-6.126, 55.635],
  totalTastings: 1200,
  totalBottles: 84,
  isFollowing: false,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

export const mockEntities: Entity[] = [
  mockEntity,
  {
    ...entityDefaults,
    ownerId: 9216,
    owner: { id: 9216, peatedId: "E9216", name: "Edrington", kind: "company" },
    country: mockCountry,
    kind: "distillery",
    id: 9202,
    peatedId: "E9202",
    name: "The Macallan",
    shortName: "Macallan",
    description:
      "A Speyside distillery known for sherry-seasoned oak maturation.",
    yearEstablished: 1824,
    website: "https://www.themacallan.com",
    region: mockRegions[1],
    address: "The Macallan Estate, Easter Elchies, Craigellachie, AB38 9RX, UK",
    location: [-3.2078, 57.4846],
    totalTastings: 2100,
    totalBottles: 190,
  },
  {
    ...entityDefaults,
    country: mockCountry,
    kind: "distillery",
    id: 9203,
    peatedId: "E9203",
    name: "Springbank",
    shortName: null,
    description:
      "A Campbeltown distillery that malts, distills, matures, and bottles whisky on site.",
    yearEstablished: 1828,
    website: "https://www.springbank.scot",
    region: mockRegions[3],
    address: "85 Longrow, Campbeltown, PA28 6EX, UK",
    location: [-5.6073, 55.4257],
    totalTastings: 980,
    totalBottles: 120,
  },
  {
    ...entityDefaults,
    ownerId: 9217,
    owner: {
      id: 9217,
      peatedId: "E9217",
      name: "Sazerac Company",
      kind: "company",
    },
    kind: "distillery",
    id: 9204,
    peatedId: "E9204",
    name: "Buffalo Trace",
    shortName: null,
    description: "A Kentucky distillery that produces bourbon and rye whiskey.",
    yearEstablished: 1858,
    website: "https://www.buffalotracedistillery.com",
    country: mockCountries[2],
    region: mockRegions[4],
    address: "113 Great Buffalo Trace, Frankfort, KY 40601, USA",
    location: [-84.8702, 38.2168],
    totalTastings: 1750,
    totalBottles: 95,
  },
  {
    ...entityDefaults,
    kind: "distillery",
    id: 9205,
    peatedId: "E9205",
    name: "Yamazaki",
    shortName: null,
    description: "Japan's first malt whisky distillery, founded near Kyoto.",
    yearEstablished: 1923,
    website: "https://house.suntory.com/yamazaki-whisky",
    country: mockCountries[3],
    region: mockOsaka,
    address: "5-2-1 Yamazaki, Shimamoto, Osaka 618-0001, Japan",
    location: [135.6745, 34.8923],
    totalTastings: 1300,
    totalBottles: 72,
  },
  {
    ...entityDefaults,
    ownerId: 9219,
    owner: {
      id: 9219,
      peatedId: "E9219",
      name: "Irish Distillers",
      kind: "company",
    },
    kind: "distillery",
    id: 9206,
    peatedId: "E9206",
    name: "Midleton",
    shortName: null,
    description:
      "An Irish distillery that produces pot still and grain whiskey.",
    yearEstablished: 1975,
    website: "https://www.midletondistillerycollection.com",
    country: mockCountries[1],
    region: mockCork,
    address: "Distillery Walk, Midleton, County Cork, P25 Y394, Ireland",
    location: [-8.1755, 51.9158],
    totalTastings: 1500,
    totalBottles: 160,
  },
  {
    ...entityDefaults,
    ownerId: 9219,
    owner: {
      id: 9219,
      peatedId: "E9219",
      name: "Irish Distillers",
      kind: "company",
    },
    id: 9207,
    peatedId: "E9207",
    name: "Redbreast",
    shortName: null,
    kind: "brand",
    description: "A range of Irish single pot still whiskey made at Midleton.",
    yearEstablished: 1912,
    website: "https://www.redbreastwhiskey.com",
    country: mockCountries[1],
    region: null,
    address: null,
    location: null,
    totalTastings: 1100,
    totalBottles: 34,
  },
  {
    ...entityDefaults,
    country: mockCountry,
    id: 9208,
    peatedId: "E9208",
    name: "Gordon & MacPhail",
    shortName: "G&M",
    kind: "bottler",
    description:
      "An independent Scotch whisky bottler and maturation specialist.",
    yearEstablished: 1895,
    website: "https://www.gordonandmacphail.com",
    region: mockRegions[1],
    address: "George House, Boroughbriggs Road, Elgin, IV30 1JY, UK",
    location: [-3.3165, 57.6534],
    totalTastings: 760,
    totalBottles: 1400,
  },
  {
    ...entityDefaults,
    id: 9209,
    peatedId: "E9209",
    name: "Compass Box",
    shortName: null,
    kind: "bottler",
    description: "A Scotch whisky blending house founded in London.",
    yearEstablished: 2000,
    website: "https://www.compassboxwhisky.com",
    country: mockCountry,
    region: null,
    address: "4th Floor, 115 George Street, Edinburgh, EH2 4JN, UK",
    location: null,
    totalTastings: 890,
    totalBottles: 75,
  },
  mockDiageoEntity,
  {
    ...entityDefaults,
    ownerId: 9220,
    owner: {
      id: 9220,
      peatedId: "E9220",
      name: "Suntory Global Spirits",
      kind: "company",
    },
    country: mockCountry,
    kind: "distillery",
    id: 9211,
    peatedId: "E9211",
    name: "Laphroaig",
    shortName: null,
    description: "An Islay distillery known for strongly peated single malt.",
    yearEstablished: 1815,
    website: "https://www.laphroaig.com",
    region: mockRegion,
    address: "Laphroaig Distillery, Port Ellen, Isle of Islay, PA42 7DU, UK",
    location: [-6.1524, 55.6305],
    totalTastings: 1850,
    totalBottles: 130,
  },
  {
    ...entityDefaults,
    country: mockCountry,
    id: 9212,
    peatedId: "E9212",
    name: "The Scotch Malt Whisky Society",
    shortName: "SMWS",
    kind: "bottler",
    description:
      "An independent bottler known for identifying single-cask releases with distillery codes.",
    yearEstablished: 1983,
    website: "https://smws.com",
    region: null,
    address: "The Vaults, 87 Giles Street, Edinburgh, EH6 6BZ, UK",
    totalTastings: 0,
    totalBottles: 0,
  },
  {
    ...entityDefaults,
    ownerId: 9216,
    owner: { id: 9216, peatedId: "E9216", name: "Edrington", kind: "company" },
    country: mockCountry,
    kind: "distillery",
    id: 9213,
    peatedId: "E9213",
    name: "Highland Park",
    shortName: null,
    description: "An island single malt distillery in Orkney.",
    yearEstablished: 1798,
    website: "https://www.highlandparkwhisky.com",
    region: mockRegions[2],
    address:
      "Highland Park Distillery, Holm Road, Kirkwall, Orkney, KW15 1SU, UK",
    totalTastings: 640,
    totalBottles: 68,
  },
  {
    ...entityDefaults,
    country: mockCountry,
    kind: "distillery",
    id: 9214,
    peatedId: "E9214",
    name: "Caol Ila",
    shortName: null,
    ownerId: 9210,
    owner: {
      id: 9210,
      kind: "company",
      peatedId: "E9210",
      name: "Diageo",
    },
    description:
      "An Islay distillery known for a lighter, maritime style of peated single malt.",
    yearEstablished: 1846,
    website: "https://www.malts.com/en-row/distilleries/caol-ila",
    region: mockRegion,
    address: "Caol Ila Distillery, Port Askaig, Isle of Islay, PA46 7RL, UK",
    location: [-6.109, 55.8543],
    totalTastings: 720,
    totalBottles: 604,
  },
  {
    ...entityDefaults,
    country: mockCountry,
    kind: "distillery",
    id: 9215,
    peatedId: "E9215",
    name: "Talisker",
    shortName: null,
    ownerId: 9210,
    owner: {
      id: 9210,
      kind: "company",
      peatedId: "E9210",
      name: "Diageo",
    },
    description:
      "An island distillery known for peppery, maritime single malt.",
    yearEstablished: 1830,
    website: "https://www.malts.com/en-row/distilleries/talisker",
    region: mockRegions[2],
    address: "Talisker Distillery, Carbost, Isle of Skye, IV47 8SR, UK",
    location: [-6.3552, 57.3026],
    totalTastings: 860,
    totalBottles: 188,
  },
  mockEdringtonEntity,
  mockSazeracCompany,
  mockPernodRicardEntity,
  mockIrishDistillersEntity,
  mockSuntoryGlobalSpiritsEntity,
  {
    ...entityDefaults,
    id: 9221,
    peatedId: "E9221",
    name: "Johnnie Walker",
    kind: "brand",
    country: mockCountry,
    ownerId: mockDiageoEntity.id,
    owner: { id: 9210, peatedId: "E9210", name: "Diageo", kind: "company" },
    yearEstablished: 1820,
    website: "https://www.johnniewalker.com",
    description:
      "A blended Scotch whisky brand founded in Kilmarnock. Its range includes Black Label and Blue Label.",
    totalBottles: 1,
    totalTastings: 74,
  },
  {
    ...entityDefaults,
    id: 9222,
    peatedId: "E9222",
    name: "Sazerac Rye",
    shortName: "Sazerac",
    kind: "brand",
    country: mockCountries[2],
    ownerId: mockSazeracCompany.id,
    owner: {
      id: 9217,
      peatedId: "E9217",
      name: "Sazerac Company",
      kind: "company",
    },
    website:
      "https://www.buffalotracedistillery.com/our-brands/sazerac-rye-whiskey/sazerac-straight-rye-whiskey/",
    description:
      "A straight rye whiskey brand produced at Buffalo Trace Distillery in Kentucky. It takes its name from the Sazerac Coffee House in New Orleans.",
    totalBottles: 1,
    totalTastings: 48,
  },
  {
    ...entityDefaults,
    id: 9223,
    peatedId: "E9223",
    name: "Amrut",
    kind: "distillery",
    country: mockCountries[4],
    region: mockKarnataka,
    website: "https://amrutdistilleries.com",
    description:
      "An Indian whisky producer based in Bengaluru, Karnataka. Fusion uses both Indian and Scottish barley, with the whisky made in India.",
    totalBottles: 1,
    totalTastings: 56,
  },
];

const followedEntityIds = new Set([9201, 9207, 9208]);

export function isMockEntityFollowing(entityId: number) {
  return followedEntityIds.has(entityId);
}

export function mockEntityFor(signedIn: boolean, entity: Entity): Entity {
  return {
    ...entity,
    isFollowing: signedIn && isMockEntityFollowing(entity.id),
  };
}

export const mockMacallanEntity = mockEntities[1]!;
export const mockSpringbankEntity = mockEntities[2]!;
export const mockBuffaloTraceEntity = mockEntities[3]!;
export const mockYamazakiEntity = mockEntities[4]!;
export const mockMidletonEntity = mockEntities[5]!;
export const mockRedbreastEntity = mockEntities[6]!;
export const mockLaphroaigEntity = mockEntities[10]!;
export const mockCaolIlaEntity = mockEntities[13]!;
export const mockTaliskerEntity = mockEntities[14]!;

export const mockCompassBoxEntity = mockEntities[8]!;
export const mockHighlandParkEntity = mockEntities[12]!;
export const mockJohnnieWalkerEntity = mockEntities[20]!;
export const mockSazeracRyeEntity = mockEntities[21]!;

export const mockAmrutEntity = mockEntities[22]!;
