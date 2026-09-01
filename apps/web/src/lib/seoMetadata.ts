import type { BottleDisplayNameSource } from "@peated/server/lib/bottleDisplayName";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { EntityKind } from "@peated/server/types";
import config from "@peated/web/config";
import type { Metadata } from "next";

import { summarize } from "./markdown";
import { getBottleSeriesUrl, getBottleUrl, getEntityUrl } from "./urls";

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
  { canonical = false }: MetadataOptions = {},
): Metadata {
  const title = `${series.fullName} — Whisky series`;
  const bottleCount = series.numReleases.toLocaleString("en-US");
  const description =
    summarize(series.description || "", 160) ||
    `See ${bottleCount} ${series.numReleases === 1 ? "bottle" : "bottles"} in the ${series.fullName} series.`;
  const url = getBottleSeriesUrl(series);

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
      url: canonical ? url : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
