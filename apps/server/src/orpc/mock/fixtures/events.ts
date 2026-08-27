import type { MockOutputs } from "../contract";
import { mockCountries } from "./places";

export const mockEvents = [
  {
    id: 9920,
    name: "Autumn Whisky Festival",
    dateStart: "2026-09-12",
    dateEnd: "2026-09-13",
    repeats: false,
    website: "https://example.com/events/autumn-whisky-festival",
    description: "Independent bottlers and distillers gather for two days.",
    country: mockCountries[0]!,
    location: [-3.19, 55.95],
  },
  {
    id: 9921,
    name: "Kentucky Bourbon Weekend",
    dateStart: "2026-09-26",
    dateEnd: null,
    repeats: true,
    website: "https://example.com/events/kentucky-bourbon-weekend",
    description: "Distillery tastings and talks from Kentucky producers.",
    country: mockCountries[2]!,
    location: [-84.5, 38.05],
  },
  {
    id: 9922,
    name: "Tokyo Malt Gathering",
    dateStart: "2026-10-08",
    dateEnd: null,
    repeats: false,
    website: null,
    description: "A small gathering focused on Japanese single malt.",
    country: mockCountries[3]!,
    location: [139.69, 35.68],
  },
  {
    id: 9923,
    name: "Spring Whisky Fair",
    dateStart: "2026-04-18",
    dateEnd: "2026-04-19",
    repeats: true,
    website: null,
    description: null,
    country: mockCountries[1]!,
    location: null,
  },
] satisfies MockOutputs["events"]["list"]["results"];
