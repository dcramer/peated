import { z } from "zod";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev";
const FIRECRAWL_TIMEOUT_MS = 60_000;
// Extra time to wait for Firecrawl's own timeout answer.
const FIRECRAWL_WAIT_PADDING_MS = 5_000;

export type FirecrawlConfig = {
  apiKey: string;
  /** Defaults to Firecrawl's hosted API. */
  apiUrl?: string | null;
};

const ScrapeResponseSchema = z
  .object({
    data: z
      .object({
        markdown: z.string().nullable().optional(),
        rawHtml: z.string().nullable().optional(),
        metadata: z
          .object({
            title: z.string().nullable().optional(),
            ogTitle: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            ogDescription: z.string().nullable().optional(),
            publishedTime: z.string().nullable().optional(),
            "article:published_time": z.string().nullable().optional(),
            url: z.string().nullable().optional(),
            sourceURL: z.string().nullable().optional(),
            statusCode: z.number().nullable().optional(),
            contentType: z.string().nullable().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

const SearchResultSchema = z
  .object({
    url: z.string().url(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

const SearchResponseSchema = z
  .object({
    data: z.object({ web: z.array(z.unknown()).default([]) }).passthrough(),
  })
  .passthrough();

/** Firecrawl could not answer. The caller decides whether to try later. */
export type FirecrawlFailure = { ok: false; httpStatus: number | null };

type FirecrawlRequest =
  | {
      path: "/v2/scrape";
      body: {
        url: string;
        formats: ["markdown" | "rawHtml"];
        onlyMainContent: boolean;
        proxy: "auto";
        timeout: number;
      };
    }
  | {
      path: "/v2/search";
      body: { query: string; limit: number; sources: ["web"] };
    };

async function callFirecrawl(
  config: FirecrawlConfig,
  fetchImpl: typeof fetch,
  { path, body }: FirecrawlRequest,
  waitMs = FIRECRAWL_TIMEOUT_MS + FIRECRAWL_WAIT_PADDING_MS,
): Promise<{ ok: true; payload: unknown } | FirecrawlFailure> {
  let response: Response;
  try {
    response = await fetchImpl(
      new URL(path, config.apiUrl ?? FIRECRAWL_API_URL),
      {
        method: "POST",
        signal: AbortSignal.timeout(waitMs),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    // Firecrawl timeouts and network failures are expected; the caller gets a
    // failed read instead of an exception.
    return { ok: false, httpStatus: null };
  }
  // A rejected API key is a deployment problem, not a page problem. Firecrawl
  // uses 403 for websites it will not read, so only 401 means the key.
  if (response.status === 401) {
    throw new Error(`Firecrawl rejected the API key (${response.status}).`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { ok: false, httpStatus: response.status };
  }
  try {
    return { ok: true, payload: await response.json() };
  } catch {
    // A cut-off or non-JSON body is a failed answer, like a network failure.
    // A JSON reply in the wrong shape still throws when it is parsed, because
    // that means Firecrawl's API changed.
    return { ok: false, httpStatus: null };
  }
}

export type FirecrawlPage = {
  ok: true;
  /** The page Firecrawl ended on, after redirects. */
  url: string;
  title: string | null;
  description: string | null;
  /** The page's published date or time, as its metadata states it. */
  publishedTime: string | null;
  content: string;
  /** The status the website gave Firecrawl. */
  httpStatus: number | null;
  /** The website's `Content-Type`, when Firecrawl reports it. */
  contentType: string | null;
};

/**
 * Reads a page through Firecrawl's `auto` proxy: a basic request first, then
 * its enhanced proxy when the website blocks it. Both cost the same credit.
 * With `timeoutMs`, the whole call, Firecrawl's work included, ends within it.
 */
export async function scrapeWithFirecrawl(
  config: FirecrawlConfig,
  fetchImpl: typeof fetch,
  url: URL,
  format: "markdown" | "rawHtml",
  timeoutMs?: number,
): Promise<FirecrawlPage | FirecrawlFailure> {
  const result = await callFirecrawl(
    config,
    fetchImpl,
    {
      path: "/v2/scrape",
      body: {
        url: url.href,
        formats: [format],
        onlyMainContent: format === "markdown",
        proxy: "auto",
        timeout: timeoutMs ?? FIRECRAWL_TIMEOUT_MS,
      },
    },
    timeoutMs,
  );
  if (!result.ok) return result;
  const { data } = ScrapeResponseSchema.parse(result.payload);
  return {
    ok: true,
    url: data.metadata?.url ?? data.metadata?.sourceURL ?? url.href,
    title:
      data.metadata?.title?.trim() || data.metadata?.ogTitle?.trim() || null,
    description:
      data.metadata?.description?.trim() ||
      data.metadata?.ogDescription?.trim() ||
      null,
    publishedTime:
      data.metadata?.publishedTime ??
      data.metadata?.["article:published_time"] ??
      null,
    content: (format === "markdown" ? data.markdown : data.rawHtml) ?? "",
    httpStatus: data.metadata?.statusCode ?? null,
    contentType: data.metadata?.contentType ?? null,
  };
}

export type SearchResult = {
  url: string;
  title: string;
  description: string | null;
};

export async function searchWithFirecrawl(
  config: FirecrawlConfig,
  fetchImpl: typeof fetch,
  query: string,
  limit: number,
): Promise<{ ok: true; results: SearchResult[] } | FirecrawlFailure> {
  const result = await callFirecrawl(config, fetchImpl, {
    path: "/v2/search",
    body: { query, limit, sources: ["web"] },
  });
  if (!result.ok) return result;
  const { data } = SearchResponseSchema.parse(result.payload);
  return {
    ok: true,
    // One malformed result is skipped instead of failing the whole search.
    results: data.web.flatMap((value) => {
      const item = SearchResultSchema.safeParse(value);
      if (!item.success) return [];
      return [
        {
          url: item.data.url,
          title: item.data.title?.trim() || item.data.url,
          description: item.data.description ?? null,
        },
      ];
    }),
  };
}
