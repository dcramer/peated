import type { Event } from "@peated/server/types";

type EventLocation = Pick<Event, "address" | "country">;

// Event addresses store the venue first and locality last. US and Canadian
// records end with both a city and region.
const COUNTRIES_WITH_TRAILING_REGION = new Set(["canada", "united-states"]);

export function formatEventLocation(event: EventLocation): string {
  const addressParts =
    event.address
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) ?? [];
  const localityParts = COUNTRIES_WITH_TRAILING_REGION.has(
    event.country?.slug ?? "",
  )
    ? addressParts.slice(-2)
    : addressParts.slice(-1);

  if (localityParts[0]?.startsWith("Across ")) {
    localityParts[0] = localityParts[0].slice("Across ".length);
  }

  const countryName = event.country?.name;
  if (
    countryName &&
    localityParts.at(-1)?.toLocaleLowerCase() ===
      countryName.toLocaleLowerCase()
  ) {
    return localityParts.join(" · ");
  }

  return [...localityParts, countryName].filter(Boolean).join(" · ");
}
