import config from "@peated/server/src/config";

export type Sitemap = {
  url: string;
  lastModified?: string | Date;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}[];

export async function buildPagesSitemap(pages: Sitemap) {
  const baseUrl = config.URL_PREFIX;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  for (const { url, lastModified, changeFrequency, priority } of pages) {
    xml += "<url>";
    xml += `<loc>${baseUrl}${url}</loc>`;
    if (lastModified) {
      xml += `<lastmod>${lastModified}</lastmod>`;
    }
    if (changeFrequency) {
      xml += `<changefreq>${changeFrequency}</changefreq>`;
    }
    if (priority) {
      xml += `<priority>${priority}</priority>`;
    }
    xml += "</url>";
  }

  xml += "</urlset>";
  return xml;
}

export async function buildSitemapIndex(sitemaps: string[]) {
  const baseUrl = config.URL_PREFIX;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  for (const url of sitemaps) {
    xml += "<sitemap>";
    xml += `<loc>${baseUrl}${url}</loc>`;
    xml += "</sitemap>";
  }

  xml += "</sitemapindex>";
  return xml;
}
