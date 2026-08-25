import type { Bottle, Entity } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BottleResultRow from "./bottleResult";

const EmptyIcon = () => null;

const timestamp = "2026-07-22T12:00:00.000Z";

const distiller = {
  id: 7,
  peatedId: "E0007",
  name: "Lagavulin",
  shortName: null,
  type: ["brand", "distiller"],
  kind: null,
  ownerId: null,
  description: null,
  descriptionSrc: null,
  yearEstablished: null,
  website: null,
  country: null,
  region: null,
  address: null,
  location: null,
  totalTastings: 0,
  totalBottles: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

const group = {
  schemaVersion: 1,
  id: 8,
  fullName: "Lagavulin 16-year-old",
  name: "16-year-old",
  brandId: distiller.id,
  bottlerId: null,
  distillerIds: [distiller.id],
  category: "single_malt",
  seriesId: null,
  statedAge: 16,
  representativeBottleId: 42,
  flavorProfile: "peated",
  avgRating: null,
  avgScore: null,
  totalScores: 0,
  ratingStats: {
    pass: 0,
    sip: 0,
    savor: 0,
    total: 0,
    avg: null,
    percentage: { pass: 0, sip: 0, savor: 0 },
  },
  totalTastings: 0,
  totalBottles: 3,
  createdByActorId: 4,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies NonNullable<Bottle["group"]>;

const exactBottle = {
  id: 42,
  peatedId: "B0042",
  fullName: "Lagavulin 16-year-old Distillers Edition",
  name: "16-year-old",
  group,
  series: null,
  category: "single_malt",
  edition: "Distillers Edition",
  statedAge: 16,
  caskStrength: true,
  singleCask: true,
  naturalColor: null,
  nonChillFiltered: null,
  abv: 43,
  vintageYear: 2008,
  releaseYear: 2024,
  caskType: "oloroso",
  caskSize: "hogshead",
  caskFill: "1st_fill",
  brand: distiller,
  distillers: [distiller],
  bottler: null,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  avgScore: null,
  totalScores: 0,
  ratingStats: {
    pass: 0,
    sip: 0,
    savor: 0,
    total: 0,
    avg: null,
    percentage: { pass: 0, sip: 0, savor: 0 },
  },
  totalTastings: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

describe("BottleResultRow", () => {
  it("keeps exact Bottle identity primary and renders distinguishing details", () => {
    const html = renderToStaticMarkup(
      <BottleResultRow
        result={{ type: "bottle", ref: exactBottle }}
        directToTasting={false}
        icon={EmptyIcon}
      />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain('href="/bottles/42"');
    expect(html).toContain('href="/bottles/42/releases"');
    expect(html).toContain("relative z-10");
    expect(text).toContain("3 related releases");
    expect(text).toContain(group.fullName);
    expect(text).not.toContain(exactBottle.fullName);
    expect(text).toContain("Distillers Edition·43.0% ABV");
    expect(text).not.toContain("16 years");
    expect(text).not.toContain("2008 vintage");
    expect(text).not.toContain("2024 release");
    expect(text).not.toContain("Single cask");
    expect(text).not.toContain("Cask strength");
    expect(text).not.toContain("1st Fill Oloroso Hogshead cask");
    expect(text).not.toContain("Single Malt");
    expect(text.match(/Distillers Edition/g)).toHaveLength(1);
    expect(text.match(/Lagavulin/g)).toHaveLength(1);
  });

  it("omits absent exact metadata without rendering empty separators", () => {
    const bottle = {
      ...exactBottle,
      fullName: "Lagavulin Classic",
      name: "Classic",
      category: null,
      edition: null,
      statedAge: null,
      caskStrength: null,
      singleCask: null,
      naturalColor: null,
      nonChillFiltered: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      distillers: [],
      group: { ...group, totalBottles: 1 },
    } satisfies Bottle;

    const html = renderToStaticMarkup(
      <BottleResultRow
        result={{ type: "bottle", ref: bottle }}
        directToTasting={false}
        icon={EmptyIcon}
      />,
    );

    expect(html).toContain('href="/bottles/42"');
    expect(html).toContain(bottle.fullName);
    expect(html).not.toContain('<span class="mx-1.5">·</span>');
    expect(html).not.toContain("ABV");
    expect(html).not.toContain("vintage");
    expect(html).not.toContain("release");
    expect(html).not.toContain("cask");
  });
});
