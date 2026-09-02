export type LocationMap =
  | { kind: "country" | "state"; slug: string }
  | {
      kind: "region";
      slug:
        | "scotland/islay"
        | "scotland/highland"
        | "scotland/speyside"
        | "scotland/lowland"
        | "scotland/campbeltown"
        | "scotland/islands";
    };

/** Selects artwork for the region itself, never its parent country. */
export function getRegionMap(
  countrySlug: string,
  regionSlug: string,
): LocationMap | null {
  if (countrySlug === "united-states") {
    return { kind: "state", slug: regionSlug };
  }
  if (countrySlug === "scotland") {
    switch (regionSlug) {
      case "islay":
      case "highland":
      case "speyside":
      case "lowland":
      case "campbeltown":
      case "islands":
        return { kind: "region", slug: `scotland/${regionSlug}` };
      // TODO(locations): Remove this alias once production uses the corrected Campbeltown slug.
      case "cambeltown":
        return { kind: "region", slug: "scotland/campbeltown" };
    }
  }
  return null;
}

/** The remaining Scottish region artwork is adapted from a CC BY-SA map. */
export function needsRegionMapCredit(visual: LocationMap | null) {
  return visual?.kind === "region" && visual.slug !== "scotland/islay";
}
