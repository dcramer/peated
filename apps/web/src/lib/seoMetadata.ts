import type { BottleDisplayNameSource } from "@peated/server/lib/bottleDisplayName";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { EntityKind } from "@peated/server/types";
import config from "@peated/web/config";
import type { Metadata } from "next";

import { summarize } from "./markdown";
import {
  getBottleSeriesUrl,
  getBottleUrl,
  getCountryUrl,
  getEntityUrl,
  getRegionUrl,
} from "./urls";

const HOME_TITLE = "Peated: Whisky bottles, reviews, and tasting notes";

export const homeMetadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: config.DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Peated",
    url: "/",
    title: HOME_TITLE,
    description: config.DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: HOME_TITLE,
    description: config.DESCRIPTION,
  },
};

type BottleSeoMetadataSource = BottleDisplayNameSource & {
  id: number;
  description: string | null;
  imageUrl: string | null;
};

type EntitySeoMetadataSource = {
  id: number;
  kind: EntityKind;
  name: string;
  description: string | null;
  images?: readonly { imageUrl: string }[];
};

type SeriesSeoMetadataSource = {
  id: number;
  fullName: string;
  description: string | null;
  numReleases: number;
};

type MetadataOptions = {
  canonical?: boolean;
};

export type SeoSearchParams = Record<string, string | string[] | undefined>;

/** Catalog SEO keeps pagination crawlable and excludes filtered or personal lists. */
export function getCatalogSeoMetadata(
  {
    title,
    description,
    url,
  }: { title: string; description: string; url: string },
  searchParams: SeoSearchParams = {},
): Metadata {
  description = description.replace(/\s+/g, " ").trim();
  if (description.length > 160)
    description = `${description.slice(0, 157).trimEnd()}...`;
  const rawCursor = searchParams.cursor;
  const cursor = Number(Array.isArray(rawCursor) ? rawCursor[0] : rawCursor);
  const canonical =
    Number.isSafeInteger(cursor) && cursor > 1
      ? `${url}?cursor=${cursor}`
      : url;
  const filtered = Object.entries(searchParams).some(
    ([key, value]) =>
      key !== "cursor" &&
      key !== "_rsc" &&
      key !== "source" &&
      key !== "ref" &&
      !key.startsWith("utm_") &&
      (Array.isArray(value) ? value.some(Boolean) : Boolean(value)),
  );
  return {
    title,
    description,
    alternates: { canonical },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Peated",
      title,
      description,
      url: canonical,
    },
    twitter: { card: "summary", title, description },
  };
}

type CountrySeoSource = {
  name: string;
  slug: string;
  description: string | null;
};
type RegionSeoSource = CountrySeoSource & {
  country: { name: string; slug: string };
};
type LocationSeoOptions = {
  section?: "bottles" | "distillers" | "regions";
  searchParams?: SeoSearchParams;
};

function getLocationSeoMetadata(
  name: string,
  description: string | null,
  url: string,
  { section, searchParams }: LocationSeoOptions,
): Metadata {
  const title =
    section === "distillers"
      ? `Whisky distilleries in ${name}`
      : section === "regions"
        ? `Whisky regions in ${name}`
        : section === "bottles"
          ? `Whisky bottles from ${name}`
          : `Whisky from ${name}`;
  const fallback =
    section === "distillers"
      ? `Browse whisky distilleries in ${name} and the bottles they make.`
      : section === "regions"
        ? `Browse whisky regions in ${name}, with bottles and distilleries from each region.`
        : `Browse whisky bottles from ${name}, with ratings and tasting notes on Peated.`;
  return getCatalogSeoMetadata(
    {
      title,
      description:
        (!section &&
          summarize(description || "", 160)
            .replace(/\s+/g, " ")
            .trim()) ||
        fallback,
      url: section ? `${url}/${section}` : url,
    },
    section ? searchParams : undefined,
  );
}

export function getCountrySeoMetadata(
  country: CountrySeoSource,
  options: LocationSeoOptions = {},
): Metadata {
  return getLocationSeoMetadata(
    country.name,
    country.description,
    getCountryUrl(country),
    options,
  );
}

export function getRegionSeoMetadata(
  region: RegionSeoSource,
  options: Omit<LocationSeoOptions, "section"> & {
    section?: "bottles" | "distillers";
  } = {},
): Metadata {
  return getLocationSeoMetadata(
    `${region.name}, ${region.country.name}`,
    region.description,
    getRegionUrl(region),
    options,
  );
}

const ENTITY_KIND_LABELS = {
  bottler: "Whisky bottler",
  brand: "Whisky brand",
  company: "Whisky company",
  distillery: "Whisky distillery",
} as const satisfies Record<EntityKind, string>;

export function getBottleSeoMetadata(
  bottle: BottleSeoMetadataSource,
  { canonical = false }: MetadataOptions = {},
): Metadata {
  const title = formatBottleDisplayName(bottle);
  const description =
    summarize(bottle.description || "", 160) ||
    `See bottle details for ${title} in the Peated whisky database.`;
  const images = bottle.imageUrl
    ? [{ url: bottle.imageUrl, alt: `${title} bottle` }]
    : undefined;
  const url = getBottleUrl(bottle);

  return {
    title,
    description,
    alternates: canonical ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Peated",
      title,
      description,
      images,
      url: canonical ? url : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images,
    },
  };
}

export function getEntitySeoMetadata(
  entity: EntitySeoMetadataSource,
  { canonical = false }: MetadataOptions = {},
): Metadata {
  const kindLabel = ENTITY_KIND_LABELS[entity.kind];
  const title = `${entity.name} — ${kindLabel}`;
  const description =
    summarize(entity.description || "", 160) ||
    `See details for ${entity.name}, a ${kindLabel.toLowerCase()}, in the Peated whisky database.`;
  const primaryImage = entity.images?.[0];
  const images = primaryImage
    ? [{ url: primaryImage.imageUrl, alt: entity.name }]
    : undefined;
  const url = getEntityUrl(entity);

  return {
    title,
    description,
    alternates: canonical ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Peated",
      title,
      description,
      images,
      url: canonical ? url : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images,
    },
  };
}

export function getSeriesSeoMetadata(
  series: SeriesSeoMetadataSource,
  {
    canonical = false,
    searchParams,
  }: MetadataOptions & { searchParams?: SeoSearchParams } = {},
): Metadata {
  const title = `${series.fullName} — Whisky series`;
  const bottleCount = series.numReleases.toLocaleString("en-US");
  const description =
    summarize(series.description || "", 160)
      .replace(/\s+/g, " ")
      .trim() ||
    `See ${bottleCount} ${series.numReleases === 1 ? "bottle" : "bottles"} in the ${series.fullName} series.`;
  const url = getBottleSeriesUrl(series);

  const metadata = getCatalogSeoMetadata(
    { title, description, url },
    searchParams,
  );
  if (!canonical) {
    metadata.alternates = undefined;
    metadata.openGraph = { ...metadata.openGraph, url: undefined };
  }
  return metadata;
}
