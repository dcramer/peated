import { load as cheerio } from "cheerio";
import { z } from "zod";

// Catalog maintenance owns this source rule: Whiskybase is read one page at a
// time, only for the Bottle being worked on, through Firecrawl. Only Bottle
// details are kept. Ratings, reviews, prices, photos, and member names are
// dropped. See docs/operations/catalog-research.md#whiskybase-lookups.

const WHISKYBASE_ORIGIN = "https://www.whiskybase.com";
const FIRECRAWL_API_URL = "https://api.firecrawl.dev";
const FIRECRAWL_TIMEOUT_MS = 60_000;
// Reuse Firecrawl's copy of a page for up to two days to keep load on
// Whiskybase low.
const FIRECRAWL_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
// "Added on" names the member who added the Bottle.
const SKIPPED_DETAIL_LABELS = new Set(["Added on"]);
const SKIPPED_SEARCH_COLUMNS = new Set([
  "photo.normal",
  "display_name",
  "id",
  "rating",
  "available",
]);

export type WhiskybaseDetail = { label: string; value: string };

export type WhiskybaseBottle = {
  whiskybaseId: number;
  url: string;
  /** Whiskybase's catalog name, which can use its own bottler abbreviations. */
  name: string;
  brand: string | null;
  /** Labels and values as Whiskybase prints them, such as "Strength". */
  details: WhiskybaseDetail[];
  /** Label badges such as "Cask Strength" or "Non-chill Filtered". */
  badges: string[];
};

export type WhiskybaseSearchResult = {
  whiskybaseId: number;
  url: string;
  name: string;
  series: string | null;
  details: WhiskybaseDetail[];
};

export type FirecrawlAccess = { apiKey: string; apiUrl?: string };

const FirecrawlScrapeSchema = z.object({
  data: z.object({
    rawHtml: z.string(),
    metadata: z.object({ statusCode: z.number() }).passthrough(),
  }),
});

// Whiskybase's schema.org Product data.
const ProductDataSchema = z.object({
  "@type": z.literal("Product"),
  name: z.string(),
  brand: z.object({ name: z.string() }).nullish(),
});

/**
 * Reads a Whiskybase ID from `WB103088`, `103088`, or a Bottle page URL.
 */
export function parseWhiskybaseId(input: string): number | null {
  const value = input.trim();
  const plain = value.match(/^(?:WB)?(\d+)$/i);
  if (plain) return Number(plain[1]);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!/(^|\.)whiskybase\.com$/.test(url.hostname)) return null;
  const path = url.pathname.match(/\/whiskies\/whisky\/(\d+)(?:\/|$)/);
  return path ? Number(path[1]) : null;
}

export function getWhiskybaseUrl(whiskybaseId: number) {
  return `${WHISKYBASE_ORIGIN}/whiskies/whisky/${whiskybaseId}`;
}

export function getWhiskybaseSearchUrl(query: string) {
  const url = new URL("/search", WHISKYBASE_ORIGIN);
  url.searchParams.set("q", query);
  return url.href;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readProductData(text: string) {
  try {
    return ProductDataSchema.safeParse(JSON.parse(text)).data ?? null;
  } catch {
    // Skip broken page data; the details list holds the Bottle facts.
    return null;
  }
}

export function readWhiskybaseBottle(html: string): WhiskybaseBottle | null {
  const $ = cheerio(html);
  const details: WhiskybaseDetail[] = [];
  const badges: string[] = [];
  let label: string | null = null;
  let whiskybaseId: number | null = null;

  $("#whisky-details dl")
    .first()
    .children()
    .each((_, node) => {
      const element = $(node);
      if (node.tagName === "dt") {
        label = cleanText(element.text());
        return;
      }
      if (node.tagName !== "dd") return;
      if (!label) {
        element.find("img[title]").each((_, image) => {
          badges.push(cleanText($(image).attr("title") ?? ""));
        });
        return;
      }

      const links = element.find("a");
      const value =
        links.length > 1 &&
        cleanText(links.text()) === cleanText(element.text())
          ? links
              .map((_, link) => cleanText($(link).text()))
              .get()
              .join(", ")
          : cleanText(element.text());
      if (label === "Whiskybase ID") {
        whiskybaseId = parseWhiskybaseId(value);
      } else if (value && !SKIPPED_DETAIL_LABELS.has(label)) {
        details.push({ label, value });
      }
      label = null;
    });

  if (whiskybaseId === null) return null;

  let name: string | null = null;
  let brand: string | null = null;
  $('script[type="application/ld+json"]').each((_, script) => {
    const product = readProductData($(script).text());
    if (!product) return;
    name = cleanText(product.name);
    brand = product.brand ? cleanText(product.brand.name) : null;
  });

  return {
    whiskybaseId,
    url:
      $('link[rel="canonical"]').attr("href") ?? getWhiskybaseUrl(whiskybaseId),
    name: name ?? cleanText($("h1").first().text()),
    brand,
    details,
    badges: badges.filter(Boolean),
  };
}

export function readWhiskybaseSearch(html: string): WhiskybaseSearchResult[] {
  const $ = cheerio(html);
  const table = $("table.es-search--table").first();
  if (!table.length) {
    if ($(":contains('No results found')").length) return [];
    // A missing table and empty state means the page did not finish loading.
    throw new Error("Whiskybase search page has no results table.");
  }

  const columns = table
    .find("thead th")
    .map((_, th) => ({
      key: $(th).attr("data-column") ?? "",
      label: cleanText($(th).text()),
    }))
    .get();

  return table
    .find("tbody tr")
    .map((_, row) => {
      const cells = $(row).children("td");
      const link = cells.find("a[href*='/whiskies/whisky/']").first();
      const whiskybaseId = parseWhiskybaseId(link.attr("href") ?? "");
      if (whiskybaseId === null) return [];

      const details: WhiskybaseDetail[] = [];
      columns.forEach((column, index) => {
        if (SKIPPED_SEARCH_COLUMNS.has(column.key)) return;
        const value = cleanText(cells.eq(index).text());
        // Whiskybase prints a bare unit when the strength is unknown.
        if (value && value !== "%vol") {
          details.push({ label: column.label, value });
        }
      });

      return {
        whiskybaseId,
        url: getWhiskybaseUrl(whiskybaseId),
        name: cleanText(link.find(".whisky-name").text()),
        series: cleanText(link.find(".whisky-serie").text()) || null,
        details,
      };
    })
    .get();
}

async function fetchWhiskybasePage({
  apiKey,
  apiUrl = FIRECRAWL_API_URL,
  url,
}: FirecrawlAccess & { url: string }) {
  const response = await fetch(new URL("/v2/scrape", apiUrl), {
    method: "POST",
    signal: AbortSignal.timeout(FIRECRAWL_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["rawHtml"],
      proxy: "basic",
      maxAge: FIRECRAWL_MAX_AGE_MS,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Firecrawl could not read Whiskybase (${response.status}).`,
    );
  }

  const { data } = FirecrawlScrapeSchema.parse(await response.json());
  return { statusCode: data.metadata.statusCode, html: data.rawHtml };
}

export async function lookupWhiskybaseBottle({
  whiskybaseId,
  ...access
}: FirecrawlAccess & {
  whiskybaseId: number;
}): Promise<WhiskybaseBottle | null> {
  const page = await fetchWhiskybasePage({
    ...access,
    url: getWhiskybaseUrl(whiskybaseId),
  });
  if (page.statusCode === 404) return null;
  if (page.statusCode !== 200) {
    throw new Error(`Whiskybase returned HTTP ${page.statusCode}.`);
  }
  return readWhiskybaseBottle(page.html);
}

export async function searchWhiskybase({
  query,
  ...access
}: FirecrawlAccess & { query: string }): Promise<WhiskybaseSearchResult[]> {
  const page = await fetchWhiskybasePage({
    ...access,
    url: getWhiskybaseSearchUrl(query),
  });
  if (page.statusCode !== 200) {
    throw new Error(`Whiskybase returned HTTP ${page.statusCode}.`);
  }
  return readWhiskybaseSearch(page.html);
}
