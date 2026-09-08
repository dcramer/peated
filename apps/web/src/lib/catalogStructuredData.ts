import {
  formatBottleDisplayName,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
import config from "@peated/web/config";
import { summarize } from "./markdown";
import {
  getCountrySeoMetadata,
  getRegionSeoMetadata,
  getSeriesSeoMetadata,
} from "./seoMetadata";
import { serializeJsonLd } from "./structuredData";
import {
  getBottleSeriesUrl,
  getBottleUrl,
  getCountryUrl,
  getEntityUrl,
  getRegionUrl,
} from "./urls";

type Breadcrumb = { name: string; url: string };

type BottleStructuredDataSource = BottleDisplayNameSource & {
  id: number;
  brand: { name: string };
  description: string | null;
  imageUrl: string | null;
  lastPrice: {
    currency: string;
    price: number;
  } | null;
};

/** Product markup only contains claims that are visible and owned by Peated. */
export function serializeBottleStructuredData(
  bottle: BottleStructuredDataSource,
): string {
  const title = formatBottleDisplayName(bottle);
  const bottleUrl = new URL(getBottleUrl(bottle), config.URL_PREFIX).href;
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${bottleUrl}#product`,
    url: bottleUrl,
    name: title,
    image: bottle.imageUrl ?? undefined,
    description: summarize(bottle.description || "", 200) || undefined,
    brand: { "@type": "Brand", name: bottle.brand.name },
    // Google forbids aggregates that include ratings from other sites. Peated's
    // saved Bottle score combines member and critic reviews, so it is omitted.
    offers: bottle.lastPrice
      ? {
          "@type": "AggregateOffer",
          offerCount: 1,
          lowPrice: bottle.lastPrice.price / 100,
          highPrice: bottle.lastPrice.price / 100,
          priceCurrency: bottle.lastPrice.currency,
        }
      : undefined,
  };

  return serializeJsonLd(data);
}

function serializeCollectionPage({
  name,
  description,
  url,
  breadcrumbs,
  about,
}: {
  name: string;
  description: string;
  url: string;
  breadcrumbs: Breadcrumb[];
  about: { "@type": "Country" | "AdministrativeArea" | "Thing"; name: string };
}) {
  const absoluteUrl = new URL(url, config.URL_PREFIX).href;
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl,
    url: absoluteUrl,
    name,
    description,
    about,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: new URL(item.url, config.URL_PREFIX).href,
      })),
    },
  };
  // Catalog SEO embeds stored descriptions and names in HTML script elements.
  return serializeJsonLd(data);
}

export function serializeSeriesStructuredData(
  series: Parameters<typeof getSeriesSeoMetadata>[0] & {
    brand: Parameters<typeof getEntityUrl>[0];
  },
) {
  const url = getBottleSeriesUrl(series);
  return serializeCollectionPage({
    name: `${series.fullName} — Whisky series`,
    description: String(getSeriesSeoMetadata(series).description),
    url,
    about: { "@type": "Thing", name: series.fullName },
    breadcrumbs: [
      { name: series.brand.name, url: getEntityUrl(series.brand) },
      { name: series.fullName, url },
    ],
  });
}

export function serializeCountryStructuredData(
  country: Parameters<typeof getCountrySeoMetadata>[0],
) {
  const url = getCountryUrl(country);
  return serializeCollectionPage({
    name: `Whisky from ${country.name}`,
    description: String(getCountrySeoMetadata(country).description),
    url,
    about: { "@type": "Country", name: country.name },
    breadcrumbs: [
      { name: "Locations", url: "/locations" },
      { name: country.name, url },
    ],
  });
}

export function serializeRegionStructuredData(
  region: Parameters<typeof getRegionSeoMetadata>[0],
) {
  const url = getRegionUrl(region);
  return serializeCollectionPage({
    name: `Whisky from ${region.name}, ${region.country.name}`,
    description: String(getRegionSeoMetadata(region).description),
    url,
    about: { "@type": "AdministrativeArea", name: region.name },
    breadcrumbs: [
      { name: "Locations", url: "/locations" },
      { name: region.country.name, url: getCountryUrl(region.country) },
      { name: region.name, url },
    ],
  });
}
