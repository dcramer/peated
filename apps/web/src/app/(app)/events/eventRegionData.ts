import { z } from "zod";

type LocatedEvent = {
  country: { slug: string } | null;
};

export const EVENT_REGIONS = [
  {
    countrySlugs: [
      "argentina",
      "brazil",
      "canada",
      "chile",
      "colombia",
      "mexico",
      "peru",
      "united-states",
      "united-states-of-america",
      "uruguay",
    ],
    label: "Americas",
    slug: "americas",
  },
  {
    countrySlugs: [
      "austria",
      "belgium",
      "czech-republic",
      "czechia",
      "denmark",
      "england",
      "estonia",
      "finland",
      "france",
      "germany",
      "iceland",
      "ireland",
      "italy",
      "netherlands",
      "northern-ireland",
      "norway",
      "poland",
      "portugal",
      "scotland",
      "spain",
      "sweden",
      "switzerland",
      "united-kingdom",
      "wales",
    ],
    label: "Europe",
    slug: "europe",
  },
  {
    countrySlugs: [
      "china",
      "hong-kong",
      "india",
      "indonesia",
      "israel",
      "japan",
      "malaysia",
      "philippines",
      "singapore",
      "south-korea",
      "taiwan",
      "thailand",
      "turkey",
      "united-arab-emirates",
    ],
    label: "Asia",
    slug: "asia",
  },
  {
    countrySlugs: ["australia", "new-zealand"],
    label: "Oceania",
    slug: "oceania",
  },
  {
    countrySlugs: ["south-africa"],
    label: "Africa",
    slug: "africa",
  },
] as const;

export type EventRegion = Pick<
  (typeof EVENT_REGIONS)[number],
  "label" | "slug"
>;

export type EventRegionOption = EventRegion & { count: number };

const EventRegionSlugSchema = z.enum([
  "americas",
  "europe",
  "asia",
  "oceania",
  "africa",
]);

const eventRegionByCountrySlug: ReadonlyMap<
  string,
  (typeof EVENT_REGIONS)[number]
> = new Map(
  EVENT_REGIONS.flatMap((region) =>
    region.countrySlugs.map((countrySlug) => [countrySlug, region] as const),
  ),
);

/** Owns the events page's display-only world grouping and URL selection. */
export function getEventRegionPageState<T extends LocatedEvent>(
  events: readonly T[],
  requestedRegion: string | string[] | undefined,
) {
  const parsedRegion = EventRegionSlugSchema.safeParse(requestedRegion);
  const selectedRegion = parsedRegion.success
    ? (EVENT_REGIONS.find((region) => region.slug === parsedRegion.data) ??
      null)
    : null;
  const counts = new Map<EventRegion["slug"], number>();

  events.forEach((event) => {
    const region = event.country
      ? eventRegionByCountrySlug.get(event.country.slug)
      : undefined;
    if (region) counts.set(region.slug, (counts.get(region.slug) ?? 0) + 1);
  });

  const options: EventRegionOption[] = EVENT_REGIONS.flatMap((region) => {
    const count = counts.get(region.slug) ?? 0;
    return count || selectedRegion?.slug === region.slug
      ? [{ count, label: region.label, slug: region.slug }]
      : [];
  });
  const results = selectedRegion
    ? events.filter(
        (event) =>
          event.country &&
          eventRegionByCountrySlug.get(event.country.slug)?.slug ===
            selectedRegion.slug,
      )
    : [...events];

  return {
    options,
    results,
    selectedRegion: selectedRegion
      ? { label: selectedRegion.label, slug: selectedRegion.slug }
      : null,
  };
}
