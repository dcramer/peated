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
      data: {
        [format]: content,
        metadata: {
          url,
          statusCode,
          title: "T",
          "article:published_time": "2026-09-01T10:00:00Z",
        },
      },
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
      description: null,
      publishedTime: null,
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
      description: null,
      publishedTime: "2026-09-01T10:00:00Z",
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

  test("reuses a page read for an hour instead of reading it again", async () => {
    const { readPage, clock, firecrawlBodies } = setup({
      "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
      scrape: firecrawlPage({
        url: "https://shop.example/page",
        content: "# Page",
        format: "markdown",
      }),
    });
    const read = () =>
      readPage({ url: "https://shop.example/page", format: "markdown" });

    await read();
    clock.now = new Date(NOW.getTime() + 59 * 60_000);
    await expect(read()).resolves.toMatchObject({
      status: "ok",
      content: "# Page",
    });
    expect(await firecrawlBodies("scrape")).toHaveLength(1);

    clock.now = new Date(NOW.getTime() + 61 * 60_000);
    await read();
    expect(await firecrawlBodies("scrape")).toHaveLength(2);
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

  test("never reads Peated's own websites, even after a redirect", async () => {
    const { readPage, readFile, requests } = setup(
      {
        "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
        "https://shop.example/a": text("", {
          status: 301,
          headers: { location: "https://peated.com/bottles/1" },
        }),
      },
      { sites: { "https://api.peated.com": { robotsException: true } } },
    );

    for (const url of [
      "https://peated.com/bottles/1",
      "https://api.peated.com/v1/bottles/1",
      "https://shop.example/a",
    ]) {
      await expect(readPage({ url, format: "html" })).resolves.toMatchObject({
        status: "refused",
        reason: "peated_website",
      });
    }
    await expect(
      readFile({ url: "https://api.peated.com/uploads/a.png", accept: "*/*" }),
    ).resolves.toMatchObject({ status: "refused", reason: "peated_website" });
    expect(
      requests.filter((request) =>
        new URL(request.url).hostname.endsWith("peated.com"),
      ),
    ).toHaveLength(0);
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

  test("treats a Vercel security checkpoint as a bot wall", async () => {
    const { readPage, botWalls } = setup(
      {
        "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
        "https://shop.example/a": text("Vercel Security Checkpoint", {
          status: 429,
          headers: { "x-vercel-mitigated": "challenge" },
        }),
      },
      { firecrawl: null },
    );

    await expect(
      readPage({ url: "https://shop.example/a", format: "html" }),
    ).resolves.toMatchObject({ status: "failed", reason: "blocked" });
    expect(botWalls).toEqual(["https://shop.example"]);
  });
});

describe("request", () => {
  const ALLOW_ALL = text("User-agent: *\nAllow: /");

  test("sends one signed request and returns a redirect as is", async () => {
    const { request, sent } = setup({
      "https://shop.example/robots.txt": ALLOW_ALL,
      "https://shop.example/old": text("", {
        status: 301,
        headers: { location: "/new" },
      }),
    });

    const result = await request({
      url: new URL("https://shop.example/old"),
      headers: { Accept: "application/json", "User-Agent": "Spoofed" },
      robots: "follow",
    });

    expect(result).toMatchObject({ status: "response", route: "direct" });
    if (result.status !== "response") throw new Error("Expected a response.");
    expect(result.response.status).toBe(301);
    expect(sent("https://shop.example/new")).toHaveLength(0);
    const sentRequest = sent("https://shop.example/old")[0];
    expect(sentRequest?.headers.get("user-agent")).toBe(BOT_USER_AGENT);
    expect(sentRequest?.headers.get("accept")).toBe("application/json");
  });

  test("does not send a request robots.txt disallows", async () => {
    const { request, sent } = setup({
      "https://shop.example/robots.txt": text(
        "User-agent: *\nDisallow: /private",
      ),
    });

    await expect(
      request({
        url: new URL("https://shop.example/private/a"),
        robots: "follow",
      }),
    ).resolves.toEqual({ status: "refused", reason: "robots_disallowed" });
    expect(sent("https://shop.example/private/a")).toHaveLength(0);
  });

  test("never sends a request to Peated's own websites", async () => {
    const { request, requests } = setup({});

    await expect(
      request({
        url: new URL("https://api.peated.com/v1/bottles"),
        robots: "not_applicable",
      }),
    ).resolves.toEqual({ status: "refused", reason: "peated_website" });
    expect(requests).toHaveLength(0);
  });

  test("skips robots.txt only when the caller says it does not apply", async () => {
    const { request, sent } = setup({
      "https://api.example/v1/products": text("[]"),
    });

    await expect(
      request({
        url: new URL("https://api.example/v1/products"),
        method: "POST",
        body: "{}",
        robots: "not_applicable",
      }),
    ).resolves.toMatchObject({ status: "response", route: "direct" });
    expect(sent("https://api.example/robots.txt")).toHaveLength(0);
  });

  test("marks a website blocked at a bot wall, then sends plain GETs through Firecrawl", async () => {
    const { request, sent, botWalls, firecrawlBodies } = setup({
      "https://shop.example/robots.txt": ALLOW_ALL,
      "https://shop.example/a": text("Just a moment...", {
        status: 403,
        headers: { "cf-mitigated": "challenge" },
      }),
      scrape: async (request) => {
        const body = await request.clone().json();
        return Response.json({
          success: true,
          data: {
            rawHtml: '{"products":[]}',
            metadata: {
              url: body.url,
              statusCode: 200,
              contentType: "application/json",
            },
          },
        });
      },
    });
    const url = new URL("https://shop.example/a");

    await expect(request({ url, robots: "follow" })).resolves.toEqual({
      status: "bot_wall",
    });
    expect(botWalls).toEqual(["https://shop.example"]);

    const result = await request({
      url,
      headers: { Accept: "application/json", "If-None-Match": "abc" },
      robots: "follow",
    });
    expect(result).toMatchObject({ status: "response", route: "firecrawl" });
    if (result.status !== "response") throw new Error("Expected a response.");
    expect(result.response.headers.get("content-type")).toBe(
      "application/json",
    );
    await expect(result.response.text()).resolves.toBe('{"products":[]}');
    expect(sent("https://shop.example/a")).toHaveLength(1);
    expect(await firecrawlBodies("scrape")).toEqual([
      expect.objectContaining({ url: "https://shop.example/a" }),
    ]);
  });

  test("reports a network failure as a failed request instead of throwing", async () => {
    const { request } = setup({
      "https://shop.example/robots.txt": ALLOW_ALL,
      "https://shop.example/a": () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(
      request({ url: new URL("https://shop.example/a"), robots: "follow" }),
    ).resolves.toEqual({
      status: "failed",
      route: "direct",
      reason: "transport",
      httpStatus: null,
    });
  });

  test("refuses a blocked website's request that Firecrawl can't send", async () => {
    const { request, requests } = setup(
      { "https://shop.example/robots.txt": ALLOW_ALL },
      { sites: { "https://shop.example": { blocked: true } } },
    );
    const url = new URL("https://shop.example/search");

    for (const input of [
      { method: "POST" as const, body: "{}" },
      { headers: { "x-algolia-api-key": "key" } },
      { directOnly: true },
    ]) {
      await expect(
        request({ url, robots: "follow", ...input }),
      ).resolves.toEqual({ status: "refused", reason: "blocked" });
    }
    expect(
      requests.filter((request) => !request.url.endsWith("/robots.txt")),
    ).toHaveLength(0);
  });

  test("drops a Firecrawl answer that ended on a page robots.txt disallows", async () => {
    const { request } = setup(
      {
        "https://shop.example/robots.txt": text(
          "User-agent: *\nDisallow: /private",
        ),
        scrape: firecrawlPage({
          url: "https://shop.example/private/a",
          content: "<html>secret</html>",
        }),
      },
      { sites: { "https://shop.example": { blocked: true } } },
    );

    await expect(
      request({ url: new URL("https://shop.example/a"), robots: "follow" }),
    ).resolves.toEqual({ status: "refused", reason: "robots_disallowed" });
  });

  test("reports cached robots.txt rules and when they were read", async () => {
    const { request, getRobotsStatus } = setup({
      "https://shop.example/robots.txt": ALLOW_ALL,
      "https://shop.example/a": text("ok"),
    });

    await expect(getRobotsStatus("https://shop.example")).resolves.toBeNull();
    await request({ url: new URL("https://shop.example/a"), robots: "follow" });
    await expect(getRobotsStatus("https://shop.example")).resolves.toEqual({
      rules: expect.objectContaining({ status: "rules" }),
      fetchedAt: NOW,
    });
  });
});

describe("readFile", () => {
  test("reads a file directly after a redirect and keeps its bytes", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const { readFile, sent } = setup({
      "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
      "https://shop.example/a.png": text("", {
        status: 302,
        headers: { location: "https://cdn.example/a.png" },
      }),
      "https://cdn.example/robots.txt": text("User-agent: *\nAllow: /"),
      "https://cdn.example/a.png": () =>
        new Response(bytes, { headers: { "content-type": "image/png" } }),
    });

    await expect(
      readFile({ url: "https://shop.example/a.png", accept: "image/*" }),
    ).resolves.toEqual({
      status: "ok",
      url: "https://cdn.example/a.png",
      contentType: "image/png",
      body: bytes,
    });
    expect(sent("https://cdn.example/robots.txt")).toHaveLength(1);
    expect(
      sent("https://cdn.example/a.png")[0]?.headers.get("user-agent"),
    ).toBe(BOT_USER_AGENT);
  });

  test("never reads a file through Firecrawl", async () => {
    const { readFile, requests, botWalls } = setup(
      {
        "https://shop.example/robots.txt": text("User-agent: *\nAllow: /"),
        "https://walled.example/robots.txt": text("User-agent: *\nAllow: /"),
        "https://walled.example/a.png": text("Just a moment...", {
          status: 403,
          headers: { "cf-mitigated": "challenge" },
        }),
      },
      { sites: { "https://shop.example": { blocked: true } } },
    );

    await expect(
      readFile({ url: "https://shop.example/a.png", accept: "image/*" }),
    ).resolves.toMatchObject({ status: "failed", reason: "blocked" });
    await expect(
      readFile({ url: "https://walled.example/a.png", accept: "image/*" }),
    ).resolves.toMatchObject({ status: "failed", reason: "blocked" });
    expect(botWalls).toEqual(["https://walled.example"]);
    expect(
      requests.filter((request) => request.url.startsWith(FIRECRAWL.apiUrl)),
    ).toHaveLength(0);
    expect(
      requests.filter(
        (request) => request.url === "https://shop.example/a.png",
      ),
    ).toHaveLength(0);
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
              { url: "not a url", title: "Broken" },
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

  test("drops results on Peated's own websites", async () => {
    const { searchWeb } = setup({
      search: () =>
        Response.json({
          data: {
            web: [
              { url: "https://peated.com/bottles/1", title: "Peated" },
              { url: "https://www.peated.com/bottles/1", title: "Peated" },
              { url: "https://notpeated.com/", title: "Other" },
            ],
          },
        }),
    });

    await expect(searchWeb({ query: "lagavulin 16" })).resolves.toEqual({
      status: "ok",
      results: [
        { url: "https://notpeated.com/", title: "Other", description: null },
      ],
    });
  });

  test("reports a reply that is not JSON as an unavailable search", async () => {
    const { searchWeb } = setup({
      search: text("<html>Bad gateway</html>", { status: 200 }),
    });

    await expect(searchWeb({ query: "q" })).resolves.toEqual({
      status: "failed",
      reason: "service_unavailable",
      httpStatus: null,
    });
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
