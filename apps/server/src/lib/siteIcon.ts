import { BOT_USER_AGENT } from "@peated/server/constants";
import { load } from "cheerio";
import sharp from "sharp";
import { z } from "zod";

const SITE_ICON_SIZE = 128;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_ICON_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_ICON_CANDIDATES = 12;
export const SITE_ICON_NOT_FOUND_MESSAGE = "No site icon was found.";
const META_ICON_SIZES = {
  "msapplication-tileimage": 144,
  "msapplication-square70x70logo": 70,
  "msapplication-square150x150logo": 150,
  "msapplication-square310x310logo": 310,
} as const;
const MetaIconNameSchema = z.enum([
  "msapplication-tileimage",
  "msapplication-square70x70logo",
  "msapplication-square150x150logo",
  "msapplication-square310x310logo",
]);

type SiteIconCandidate = {
  order: number;
  size: number;
  url: URL;
};

const ManifestSchema = z.looseObject({
  icons: z
    .array(
      z.looseObject({
        sizes: z.string().optional(),
        src: z.string(),
        type: z.string().optional(),
      }),
    )
    .default([]),
});

class SiteIconFetchError extends Error {
  override name = "SiteIconFetchError";
}

function siteHostname(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function isSameSite(left: URL, right: URL) {
  return (
    left.protocol === right.protocol &&
    siteHostname(left) === siteHostname(right) &&
    left.port === right.port
  );
}

function iconSize(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  if (value.toLowerCase().split(/\s+/).includes("any")) return 512;

  let largest = 0;
  for (const token of value.split(/\s+/)) {
    const match = /^(\d+)x(\d+)$/i.exec(token);
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width === height) largest = Math.max(largest, width);
  }
  return largest || fallback;
}

function candidateUrl(value: string, baseUrl: URL) {
  try {
    const url = new URL(value, baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !isSameSite(url, baseUrl)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** Finds homepage icon and manifest declarations without fetching them. */
export function findSiteIconDeclarations(html: string, pageUrl: URL) {
  const $ = load(html);
  const icons: SiteIconCandidate[] = [];
  const manifests: URL[] = [];
  let order = 0;

  for (const element of $("link[rel][href]").toArray()) {
    const rel = ($(element).attr("rel") ?? "").toLowerCase().trim();
    const href = $(element).attr("href");
    if (!href) continue;
    const url = candidateUrl(href, pageUrl);
    if (!url) continue;

    const tokens = new Set(rel.split(/\s+/));
    if (tokens.has("manifest")) {
      manifests.push(url);
      continue;
    }

    let fallbackSize = 0;
    if (tokens.has("icon")) fallbackSize = 32;
    if (
      tokens.has("apple-touch-icon") ||
      tokens.has("apple-touch-icon-precomposed")
    ) {
      fallbackSize = 180;
    }
    if (tokens.has("fluid-icon")) fallbackSize = 256;
    if (tokens.has("mask-icon")) fallbackSize = 64;
    if (!fallbackSize) continue;

    const vector =
      $(element).attr("type")?.toLowerCase() === "image/svg+xml" ||
      url.pathname.toLowerCase().endsWith(".svg");
    icons.push({
      order: order++,
      size: iconSize(
        $(element).attr("sizes"),
        vector && tokens.has("icon") ? 512 : fallbackSize,
      ),
      url,
    });
  }

  for (const element of $("meta[name][content]").toArray()) {
    const name = MetaIconNameSchema.safeParse(
      ($(element).attr("name") ?? "").toLowerCase(),
    );
    const content = $(element).attr("content");
    if (!name.success || !content) continue;
    const url = candidateUrl(content, pageUrl);
    if (url) {
      icons.push({ order: order++, size: META_ICON_SIZES[name.data], url });
    }
  }

  return { icons, manifests };
}

async function readBounded(response: Response, maximumBytes: number) {
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) > maximumBytes) {
    await response.body?.cancel();
    throw new SiteIconFetchError("Site icon response was too large.");
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new SiteIconFetchError("Site icon response was too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

async function fetchSameSite(
  initialUrl: URL,
  siteUrl: URL,
  maximumBytes: number,
  accept: string,
  fetchImpl: typeof fetch,
) {
  let url = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !isSameSite(url, siteUrl)
    ) {
      throw new SiteIconFetchError("Site icon URL left the source website.");
    }
    const response = await fetchImpl(url, {
      headers: { Accept: accept, "User-Agent": BOT_USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === MAX_REDIRECTS) {
        throw new SiteIconFetchError("Site icon redirect failed.");
      }
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new SiteIconFetchError(
        `Site icon request returned ${response.status}.`,
      );
    }
    return { data: await readBounded(response, maximumBytes), url };
  }
  throw new SiteIconFetchError("Site icon redirect failed.");
}

function sortCandidates(candidates: SiteIconCandidate[]) {
  const deduplicated = new Map<string, SiteIconCandidate>();
  for (const candidate of candidates) {
    const key = candidate.url.toString();
    const current = deduplicated.get(key);
    if (!current || candidate.size > current.size) {
      deduplicated.set(key, candidate);
    }
  }
  return [...deduplicated.values()]
    .sort((left, right) => right.size - left.size || left.order - right.order)
    .slice(0, MAX_ICON_CANDIDATES);
}

async function normalizeIcon(data: Buffer) {
  return await sharp(data, { density: 128, limitInputPixels: 16_777_216 })
    .rotate()
    .resize(SITE_ICON_SIZE, SITE_ICON_SIZE, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .webp({ quality: 90 })
    .toBuffer();
}

/** Downloads the best same-site icon declared by a homepage and returns WebP. */
export async function downloadSiteIcon(
  pageUrl: URL,
  fetchImpl: typeof fetch = fetch,
) {
  const homepageUrl = new URL("/", pageUrl);
  const homepage = await fetchSameSite(
    homepageUrl,
    homepageUrl,
    MAX_PAGE_BYTES,
    "text/html,application/xhtml+xml",
    fetchImpl,
  );
  const declarations = findSiteIconDeclarations(
    new TextDecoder().decode(homepage.data),
    homepage.url,
  );
  const candidates = [...declarations.icons];
  let order = candidates.length;

  for (const manifestUrl of declarations.manifests) {
    try {
      const response = await fetchSameSite(
        manifestUrl,
        homepage.url,
        MAX_MANIFEST_BYTES,
        "application/manifest+json,application/json",
        fetchImpl,
      );
      const manifest = ManifestSchema.parse(
        JSON.parse(new TextDecoder().decode(response.data)),
      );
      for (const icon of manifest.icons) {
        const url = candidateUrl(icon.src, response.url);
        if (!url) continue;
        candidates.push({
          order: order++,
          size: iconSize(
            icon.sizes,
            icon.type?.toLowerCase() === "image/svg+xml" ||
              url.pathname.toLowerCase().endsWith(".svg")
              ? 512
              : 64,
          ),
          url,
        });
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      // A broken optional manifest must not hide usable HTML icon links.
    }
  }

  candidates.push({
    order: order++,
    size: 16,
    url: new URL("/favicon.ico", homepage.url),
  });

  for (const candidate of sortCandidates(candidates)) {
    try {
      const { data } = await fetchSameSite(
        candidate.url,
        homepage.url,
        MAX_ICON_BYTES,
        "image/*,*/*;q=0.1",
        fetchImpl,
      );
      return {
        data: await normalizeIcon(data),
        sourceUrl: candidate.url.toString(),
      };
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      // Invalid and missing candidates are expected; try the next declaration.
    }
  }
  throw new SiteIconFetchError(SITE_ICON_NOT_FOUND_MESSAGE);
}
