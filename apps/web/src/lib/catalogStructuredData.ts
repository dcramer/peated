import config from "@peated/web/config";
import {
  getCountrySeoMetadata,
  getRegionSeoMetadata,
  getSeriesSeoMetadata,
} from "./seoMetadata";
import {
  getBottleSeriesUrl,
  getCountryUrl,
  getEntityUrl,
  getRegionUrl,
} from "./urls";

type Breadcrumb = { name: string; url: string };

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
  return JSON.stringify(data).replace(/</g, "\\u003c");
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
