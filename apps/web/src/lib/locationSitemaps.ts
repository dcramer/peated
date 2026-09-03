import type { Sitemap } from "./sitemaps";
import { getCountryUrl, getRegionUrl } from "./urls";

type Page<T> = { results: T[]; rel: { nextCursor: number | null } };

export async function loadSitemapCountries(
  list: (input: {
    cursor: number;
    limit: number;
    sort: "name";
  }) => Promise<Page<{ slug: string }>>,
) {
  const countries: { slug: string }[] = [];
  let cursor: number | null = 1;
  while (cursor) {
    const page = await list({ cursor, limit: 100, sort: "name" });
    countries.push(...page.results);
    cursor = page.rel.nextCursor;
  }
  return countries;
}

export function getCountrySitemapPages(countries: { slug: string }[]): Sitemap {
  return [
    { url: "/locations" },
    { url: "/locations/all-regions" },
    ...countries.flatMap((country) =>
      ["", "/bottles", "/distillers", "/regions"].map((suffix) => ({
        url: `${getCountryUrl(country)}${suffix}`,
      })),
    ),
  ];
}

export async function loadRegionSitemap(
  country: string,
  list: (input: {
    country: string;
    cursor: number;
    limit: number;
    sort: "name";
  }) => Promise<Page<Parameters<typeof getRegionUrl>[0]>>,
): Promise<Sitemap> {
  const pages: Sitemap = [];
  let cursor: number | null = 1;
  while (cursor) {
    const page = await list({ country, cursor, limit: 100, sort: "name" });
    pages.push(
      ...page.results.flatMap((region) =>
        ["", "/bottles", "/distillers"].map((suffix) => ({
          url: `${getRegionUrl(region)}${suffix}`,
        })),
      ),
    );
    cursor = page.rel.nextCursor;
  }
  return pages;
}
