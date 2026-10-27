import { describe, expect, test } from "vitest";
import { createPeatedBot } from "./bot";
import { BOT_USER_AGENT } from "./identity";
import { type BotSiteSettings, createMemoryCache } from "./sites";

const FIRECRAWL = { apiKey: "test-key", apiUrl: "https://firecrawl.test" };
const NOW = new Date("2026-10-27T12:00:00Z");

type Route = (request: Request) => Response | Promise<Response>;

/** A fake network: each key is a URL, or `scrape`/`search` for Firecrawl. */
function createNetwork(routes: Record<string, Route>) {
  const requests: Request[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    const url = new URL(request.url);
    const key =
      url.origin === FIRECRAWL.apiUrl
        ? url.pathname.replace("/v2/", "")
        : url.href;
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${request.url}`);
    return await route(request);
  };
  const sent = (url: string) =>
    requests.filter((request) => request.url === url);
  const firecrawlBodies = async (path: "scrape" | "search") =>
    await Promise.all(
      requests
        .filter((request) => request.url === `${FIRECRAWL.apiUrl}/v2/${path}`)
        .map(async (request) => await request.clone().json()),
    );
  return { fetch, requests, sent, firecrawlBodies };
}

function text(body: string, init: ResponseInit = {}) {
  return () => new Response(body, init);
}

function firecrawlPage({
  url,
  content,
  statusCode = 200,
  format = "rawHtml",
}: {
  url: string;
  content: string;
  statusCode?: number;
  format?: "rawHtml" | "markdown";
}) {
  return () =>
    Response.json({
      success: true,
      data: { [format]: content, metadata: { url, statusCode, title: "T" } },
    });
}

function setup(
  routes: Record<string, Route>,
  {
    sites: initial = {},
    firecrawl = FIRECRAWL,
    privateJwk = null,
  }: {
    sites?: Record<string, Partial<BotSiteSettings>>;
    firecrawl?: typeof FIRECRAWL | null;
    privateJwk?: string | null;
  } = {},
) {
  const network = createNetwork(routes);
  const clock = { now: NOW };
  const sites = new Map(
    Object.entries(initial).map(([origin, site]) => [
      origin,
      { robotsException: false, blocked: false, ...site },
    ]),
  );
  const botWalls: string[] = [];
  const bot = createPeatedBot({
    cache: createMemoryCache(() => clock.now),
    getSite: async (origin) =>
      sites.get(origin) ?? { robotsException: false, blocked: false },
    onBotWall: async (origin) => {
      botWalls.push(origin);
      sites.set(origin, { robotsException: false, blocked: true });
    },
    firecrawl,
    privateJwk,
    fetch: network.fetch,
    now: () => clock.now,
  });
  return { ...network, clock, botWalls, ...bot };
}

describe("readPage", () => {
  test("reads a page directly as PeatedBot and caches robots.txt", async () => {
    const { readPage, sent, clock } = setup({
      "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
      "https://shop.example/a": text("<html>A</html>"),
      "https://shop.example/b": text("<html>B</html>"),
    });

    await expect(
      readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toEqual({
      status: "ok",
      url: "https://shop.example/a",
      title: null,
      content: "<html>A</html>",
      route: "direct",
    });
    await readPage({ url: "https://shop.example/b", format: "html" });

    expect(sent("https://shop.example/robots.txt")).toHaveLength(1);
    expect(sent("https://shop.example/a")[0]?.headers.get("user-agent")).toBe(
      BOT_USER_AGENT,
    );

    clock.now = new Date("2026-10-28T12:00:01Z");
    await readPage({ url: "https://shop.example/b", format: "html" });
    expect(sent("https://shop.example/robots.txt")).toHaveLength(2);
  });

  test("does not read a page robots.txt disallows, by any route", async () => {
    const { readPage, requests } = setup({
      "https://shop.example/robots.txt": text(
        "User-agent: *\nDisallow: /private",
      ),
    });

    await expect(
      readPage({ url: "https://shop.example/private/a", format: "html" }),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "robots_disallowed",
    });
    await expect(
      readPage({ url: "https://shop.example/private/a", format: "markdown" }),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "robots_disallowed",
    });

    expect(requests.map((request) => request.url)).toEqual([
      "https://shop.example/robots.txt",
    ]);
  });

  test("reads a disallowed page when an admin made a robots.txt exception", async () => {
    const { readPage, sent } = setup(
      { "https://shop.example/private": text("<html>P</html>") },
      { sites: { "https://shop.example": { robotsException: true } } },
    );

    await expect(
      readPage({ url: "https://shop.example/private", format: "html" }),
    ).resolves.toMatchObject({ status: "ok", route: "direct" });
    expect(sent("https://shop.example/robots.txt")).toHaveLength(0);
  });

  test("treats a 4xx robots.txt as no rules and a 5xx as unknown", async () => {
    const missing = setup({
      "https://shop.example/robots.txt": text("", { status: 404 }),
      "https://shop.example/a": text("A"),
    });
    await expect(
      missing.readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toMatchObject({ status: "ok" });

    const down = setup({
      "https://shop.example/robots.txt": text("", { status: 503 }),
    });
    await expect(
      down.readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "robots_unavailable",
    });
    expect(down.sent("https://shop.example/a")).toHaveLength(0);
  });

  test("leaves the rules unknown when robots.txt answers 429 or 408", async () => {
    for (const status of [429, 408]) {
      const { readPage, sent } = setup({
        "https://shop.example/robots.txt": text("", { status }),
      });

      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(
          readPage({ url: "https://shop.example/a", format: "html" }),
        ).resolves.toMatchObject({
          status: "refused",
          reason: "robots_unavailable",
        });
      }
      expect(sent("https://shop.example/robots.txt")).toHaveLength(2);
      expect(sent("https://shop.example/a")).toHaveLength(0);
    }
  });

  test("marks a website blocked at a bot wall and reads it through Firecrawl after that", async () => {
    const { readPage, sent, botWalls, firecrawlBodies } = setup({
      "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
      "https://shop.example/a": text("Just a moment...", {
        status: 403,
        headers: { "cf-mitigated": "challenge" },
      }),
      scrape: async (request) => {
        const { url } = await request.clone().json();
        return firecrawlPage({ url, content: `<html>${url}</html>` })();
      },
    });

    await expect(
      readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toMatchObject({
      status: "ok",
      content: "<html>https://shop.example/a</html>",
      route: "firecrawl",
    });
    expect(botWalls).toEqual(["https://shop.example"]);

    await readPage({ url: "https://shop.example/b", format: "html" });
    expect(sent("https://shop.example/b")).toHaveLength(0);
    expect(await firecrawlBodies("scrape")).toEqual([
      expect.objectContaining({
        url: "https://shop.example/a",
        formats: ["rawHtml"],
        proxy: "auto",
      }),
      expect.objectContaining({ url: "https://shop.example/b" }),
    ]);
  });

  test("never bypasses a plain 403 or a login", async () => {
    const { readPage, firecrawlBodies, botWalls } = setup({
      "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
      "https://shop.example/forbidden": text("no", { status: 403 }),
      "https://shop.example/account": text("log in", { status: 401 }),
    });

    await expect(
      readPage({ url: "https://shop.example/forbidden", format: "html" }),
    ).resolves.toMatchObject({
      status: "failed",
      reason: "http_error",
      httpStatus: 403,
    });
    await expect(
      readPage({ url: "https://shop.example/account", format: "html" }),
    ).resolves.toMatchObject({ status: "refused", reason: "login_required" });

    expect(await firecrawlBodies("scrape")).toEqual([]);
    expect(botWalls).toEqual([]);
  });

  test("reads robots.txt through Firecrawl when it sits behind the bot wall", async () => {
    const wall = text("Just a moment...", {
      status: 403,
      headers: { "cf-mitigated": "challenge" },
    });
    const { readPage, firecrawlBodies } = setup({
      "https://shop.example/robots.txt": wall,
      scrape: firecrawlPage({
        url: "https://shop.example/robots.txt",
        content:
          "<html><body><pre>User-agent: *\nDisallow: /private</pre></body></html>",
      }),
    });

    await expect(
      readPage({ url: "https://shop.example/private/a", format: "html" }),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "robots_disallowed",
    });
    expect(await firecrawlBodies("scrape")).toEqual([
      expect.objectContaining({ url: "https://shop.example/robots.txt" }),
    ]);
  });

  test("leaves the rules unknown when Firecrawl cannot get the real robots.txt", async () => {
    const wall = text("Just a moment...", {
      status: 403,
      headers: { "cf-mitigated": "challenge" },
    });
    for (const answer of [
      firecrawlPage({
        url: "https://shop.example/robots.txt",
        content: "Forbidden",
        statusCode: 403,
      }),
      firecrawlPage({
        url: "https://shop.example/robots.txt",
        content: "<html><body><h1>Checking your browser</h1></body></html>",
      }),
    ]) {
      const { readPage, firecrawlBodies } = setup({
        "https://shop.example/robots.txt": wall,
        scrape: answer,
      });

      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(
          readPage({ url: "https://shop.example/private", format: "html" }),
        ).resolves.toMatchObject({
          status: "refused",
          reason: "robots_unavailable",
        });
      }
      expect(await firecrawlBodies("scrape")).toHaveLength(2);
    }
  });

  test("checks robots.txt again after a redirect", async () => {
    const { readPage, sent } = setup({
      "https://shop.example/robots.txt": text(
        "User-agent: *\nDisallow: /private",
      ),
      "https://shop.example/a": text("", {
        status: 301,
        headers: { location: "/private/a" },
      }),
    });

    await expect(
      readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "robots_disallowed",
    });
    expect(sent("https://shop.example/private/a")).toHaveLength(0);
  });

  test("reads markdown through Firecrawl and drops a redirect to a disallowed page", async () => {
    const { readPage } = setup({
      "https://shop.example/robots.txt": text(
        "User-agent: *\nDisallow: /private",
      ),
      scrape: async (request) => {
        const { url } = await request.clone().json();
        return firecrawlPage({
          url: url.endsWith("/moved")
            ? "https://shop.example/private/page"
            : url,
          content: "# Page",
          format: "markdown",
        })();
      },
    });

    await expect(
      readPage({ url: "https://shop.example/page", format: "markdown" }),
    ).resolves.toEqual({
      status: "ok",
      url: "https://shop.example/page",
      title: "T",
      content: "# Page",
      route: "firecrawl",
    });
    await expect(
      readPage({ url: "https://shop.example/moved", format: "markdown" }),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "robots_disallowed",
    });
  });

  test("reports a malformed redirect instead of throwing", async () => {
    const { readPage } = setup({
      "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
      "https://shop.example/a": text("", {
        status: 302,
        headers: { location: "http://[bad" },
      }),
    });

    await expect(
      readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toMatchObject({
      status: "failed",
      reason: "http_error",
      httpStatus: 302,
    });
  });

  test("throws on a bad signing key instead of reporting a network failure", async () => {
    const { readPage } = setup(
      { "https://shop.example/robots.txt": text("") },
      { privateJwk: '{"kty":"OKP","crv":"Ed25519"}' },
    );

    await expect(
      readPage({ url: "https://shop.example/a", format: "html" }),
    ).rejects.toThrow(
      "PEATED_BOT_PRIVATE_JWK must contain a private Ed25519 JWK.",
    );
  });

  test("reports a website Firecrawl will not read as blocked", async () => {
    const { readPage } = setup({
      "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
      scrape: text("", { status: 403 }),
    });

    await expect(
      readPage({ url: "https://shop.example/a", format: "markdown" }),
    ).resolves.toMatchObject({
      status: "failed",
      reason: "blocked",
      httpStatus: 403,
    });
  });

  test("refuses private addresses and addresses with credentials without a request", async () => {
    const { readPage, requests } = setup({});

    await expect(
      readPage({ url: "http://127.0.0.1/admin", format: "html" }),
    ).resolves.toMatchObject({ status: "refused", reason: "not_public" });
    await expect(
      readPage({ url: "https://user:pass@shop.example/", format: "html" }),
    ).resolves.toMatchObject({ status: "refused", reason: "invalid_url" });
    expect(requests).toHaveLength(0);
  });

  test("reports a bot wall as blocked when Firecrawl is not configured", async () => {
    const { readPage } = setup(
      {
        "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
        "https://shop.example/a": text("", {
          status: 403,
          headers: { "x-datadome": "protected" },
        }),
      },
      { firecrawl: null },
    );

    await expect(
      readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toMatchObject({ status: "failed", reason: "blocked" });
  });
});

describe("searchWeb", () => {
  test("returns links from Firecrawl search", async () => {
    const { searchWeb, firecrawlBodies } = setup({
      search: () =>
        Response.json({
          data: {
            web: [
              { url: "https://a.example/", title: " A ", description: "x" },
              { url: "https://b.example/" },
            ],
          },
        }),
    });

    await expect(searchWeb({ query: "lagavulin 16" })).resolves.toEqual({
      status: "ok",
      results: [
        { url: "https://a.example/", title: "A", description: "x" },
        {
          url: "https://b.example/",
          title: "https://b.example/",
          description: null,
        },
      ],
    });
    expect(await firecrawlBodies("search")).toEqual([
      { query: "lagavulin 16", limit: 8, sources: ["web"] },
    ]);
  });

  test("reports an unavailable search and throws on a rejected API key", async () => {
    const outOfCredits = setup({ search: text("", { status: 402 }) });
    await expect(outOfCredits.searchWeb({ query: "q" })).resolves.toEqual({
      status: "failed",
      reason: "service_unavailable",
      httpStatus: 402,
    });

    const badKey = setup({ search: text("", { status: 401 }) });
    await expect(badKey.searchWeb({ query: "q" })).rejects.toThrow(
      "Firecrawl rejected the API key (401).",
    );
  });
});
