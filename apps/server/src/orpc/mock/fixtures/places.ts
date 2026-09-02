import type { MockOutputs } from "../contract";

type Country = MockOutputs["countries"]["details"];
type Region = MockOutputs["regions"]["details"];

// Places
export const mockCountry = {
  id: 9401,
  name: "Scotland",
  slug: "scotland",
  description: "A major whisky-producing country.",
  summary: "Home to distinct whisky regions and styles.",
  location: [-4.2, 56.5],
  totalBottles: 8200,
  totalDistillers: 150,
} satisfies Country;

export const mockEngland = {
  id: 9406,
  name: "England",
  slug: "england",
  description:
    "Home to whisky distilleries, blending houses, and drinks companies.",
  summary: "English whisky and the companies behind other whisky brands.",
  location: [-1.5, 52.5],
  totalBottles: 0,
  totalDistillers: 0,
} satisfies Country;

export const mockFrance = {
  id: 9407,
  name: "France",
  slug: "france",
  description:
    "Produces malt whisky and is home to international drinks companies.",
  summary: "French whisky and international whisky producers.",
  location: [2.2, 46.6],
  totalBottles: 0,
  totalDistillers: 0,
} satisfies Country;

export const mockCountries: Country[] = [
  mockCountry,
  {
    id: 9402,
    name: "Ireland",
    slug: "ireland",
    description:
      "Known for blended whiskey and single pot still whiskey made from malted and unmalted barley.",
    summary: "The home of Irish whiskey and the single pot still style.",
    location: [-8, 53.4],
    totalBottles: 1100,
    totalDistillers: 42,
  },
  {
    id: 9403,
    name: "United States of America",
    slug: "united-states",
    description:
      "A large whiskey-producing country best known for bourbon and rye.",
    summary: "Bourbon, rye, and a growing range of regional whiskey styles.",
    location: [-98.6, 39.8],
    totalBottles: 6100,
    totalDistillers: 2100,
  },
  {
    id: 9404,
    name: "Japan",
    slug: "japan",
    description:
      "Produces precise blends and single malts influenced by Scottish methods.",
    summary: "Elegant blends and single malts from a varied climate.",
    location: [138.3, 36.2],
    totalBottles: 760,
    totalDistillers: 90,
  },
  {
    id: 9405,
    name: "India",
    slug: "india",
    description:
      "Warm maturation conditions produce bold single malts at a fast pace.",
    summary: "Rich single malts shaped by a warm climate.",
    location: [78.9, 20.6],
    totalBottles: 420,
    totalDistillers: 35,
  },
  mockEngland,
  mockFrance,
];

export const mockRegion = {
  id: 9501,
  name: "Islay",
  slug: "islay",
  country: mockCountry,
  description: "An island region known for smoky single malt whisky.",
  location: [-6.2, 55.8],
  totalBottles: 680,
  totalDistillers: 10,
} satisfies Region;

export const mockKarnataka = {
  id: 9506,
  name: "Karnataka",
  slug: "karnataka",
  country: mockCountries[4],
  description: "A state in southern India. Bengaluru is home to Amrut.",
  location: [76, 15],
  totalBottles: 1,
  totalDistillers: 1,
} satisfies Region;

export const mockOsaka = {
  id: 9507,
  name: "Osaka",
  slug: "osaka",
  country: mockCountries[3],
  description:
    "A prefecture in Japan's Kansai region. Yamazaki Distillery is in Shimamoto, near the border with Kyoto.",
  location: [135.5, 34.7],
  totalBottles: 72,
  totalDistillers: 1,
} satisfies Region;

export const mockCork = {
  id: 9508,
  name: "County Cork",
  slug: "county-cork",
  country: mockCountries[1],
  description:
    "A county in southern Ireland and the home of Midleton Distillery.",
  location: [-8.5, 51.9],
  totalBottles: 160,
  totalDistillers: 1,
} satisfies Region;

export const mockRegions: Region[] = [
  mockRegion,
  {
    id: 9502,
    name: "Speyside",
    slug: "speyside",
    country: mockCountry,
    description:
      "A dense center of Scotch whisky production known for fruit-forward single malts.",
    location: [-3.3, 57.5],
    totalBottles: 2500,
    totalDistillers: 50,
  },
  {
    id: 9503,
    name: "Highlands",
    slug: "highlands",
    country: mockCountry,
    description:
      "A broad Scotch whisky region with coastal, fruity, and rich styles.",
    location: [-4.7, 57.1],
    totalBottles: 2200,
    totalDistillers: 47,
  },
  {
    id: 9504,
    name: "Campbeltown",
    slug: "campbeltown",
    country: mockCountry,
    description:
      "A small coastal Scotch whisky region known for oily and lightly smoky malts.",
    location: [-5.6, 55.4],
    totalBottles: 310,
    totalDistillers: 3,
  },
  {
    id: 9505,
    name: "Kentucky",
    slug: "kentucky",
    country: mockCountries[2],
    description:
      "The center of American bourbon production, with limestone water and hot summers.",
    location: [-84.9, 37.8],
    totalBottles: 3400,
    totalDistillers: 130,
  },
  mockKarnataka,
  mockOsaka,
  mockCork,
];
